from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from market.models import Stock, DailyPrice
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoAlertPresentException
from bs4 import BeautifulSoup
from decimal import Decimal
from datetime import datetime
import time


class Command(BaseCommand):
    help = 'Scrape historical price data for a stock symbol'
    
    def add_arguments(self, parser):
        parser.add_argument('symbol', type=str, help='Stock symbol to scrape')
        parser.add_argument('--max-pages', type=int, default=60, help='Maximum pages to scrape')
        parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    
    def handle(self, *args, **options):
        symbol = options['symbol']
        max_pages = options['max_pages']
        headless = options['headless']
        
        self.stdout.write(f'Starting historical scrape for {symbol}...')
        
        # Setup Chrome
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--disable-notifications")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)        
        try:
            # Navigate to Mero Lagani
            driver.get("https://merolagani.com")
            
            # Wait for search input
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "ctl00_AutoSuggest1_txtAutoSuggest"))
            )
            
            # Inject search term
            driver.execute_script(f"""
                const input = document.getElementById('ctl00_AutoSuggest1_txtAutoSuggest');
                input.value = '{symbol}';
                input.dispatchEvent(new Event('input'));
                AutoSuggest.getAutoSuggestDataByElement('Company', input);
            """)
            
            time.sleep(4)
            
            # Click search
            search_button = driver.find_element(By.ID, "ctl00_lbtnSearch")
            search_button.click()
            
            self.handle_alert(driver)
            
            # Click Price History tab
            price_history_tab = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "navHistory"))
            )
            price_history_tab.click()
            
            # Wait for table
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "table.table.table-bordered tbody tr:nth-child(2)"))
            )
            
            self.stdout.write(self.style.SUCCESS('Price history table loaded'))
            
            # Scrape all pages
            all_data = []
            current_page = 1
            
            while current_page <= max_pages:
                page_data = self.scrape_page(driver)
                if page_data:
                    all_data.extend(page_data)
                    self.stdout.write(f'Page {current_page}: {len(page_data)} records')
                
                if self.is_last_page(driver):
                    self.stdout.write('Reached last page')
                    break
                
                if not self.click_next_page(driver):
                    self.stdout.write('Could not navigate to next page')
                    break
                
                current_page += 1
                time.sleep(2)
            
            # Save to database
            self.save_to_database(symbol, all_data)
            
        finally:
            driver.quit()
    
    def scrape_page(self, driver):
        """Scrape current page data"""
        page_data = []
        soup = BeautifulSoup(driver.page_source, "html.parser")
        
        tables = soup.select("table.table.table-bordered")
        tables_with_tbody = [t for t in tables if t.find("tbody")]
        
        if not tables_with_tbody:
            return page_data
        
        table = tables_with_tbody[-1]
        tbody = table.find("tbody")
        rows = tbody.find_all("tr")
        
        for row in rows[1:]:  # Skip header
            cols = row.find_all("td")
            if len(cols) >= 9:
                try:
                    page_data.append({
                        'date': cols[1].text.strip(),
                        'close': cols[2].text.strip(),
                        'change': cols[3].text.strip(),
                        'high': cols[4].text.strip(),
                        'low': cols[5].text.strip(),
                        'open': cols[6].text.strip(),
                        'quantity': cols[7].text.strip(),
                        'turnover': cols[8].text.strip(),
                    })
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Error parsing row: {e}'))
        
        return page_data
    
    def save_to_database(self, symbol, data):
        """Save scraped data to Django models"""
        if not data:
            self.stdout.write(self.style.WARNING('No data to save'))
            return
        
        # Get or create stock
        stock, created = Stock.objects.get_or_create(
            symbol=symbol,
            defaults={'name': symbol}
        )
        
        saved = 0
        
        with transaction.atomic():
            for record in data:
                try:
                    # Parse date
                    date_str = record['date']
                    date_obj = datetime.strptime(date_str, '%Y/%m/%d').date()
                    
                    # Clean values
                    open_price = self.clean_decimal(record['open'])
                    high_price = self.clean_decimal(record['high'])
                    low_price = self.clean_decimal(record['low'])
                    close_price = self.clean_decimal(record['close'])
                    volume = self.clean_int(record['quantity'])
                    
                    if not close_price:
                        continue
                    
                    # Create or update
                    DailyPrice.objects.update_or_create(
                        stock=stock,
                        date=date_obj,
                        defaults={
                            'open': open_price or close_price,
                            'high': high_price or close_price,
                            'low': low_price or close_price,
                            'close': close_price,
                            'volume': volume or 0,
                        }
                    )
                    
                    saved += 1
                    
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Error saving {record["date"]}: {e}'))
        
        self.stdout.write(self.style.SUCCESS(f'Saved {saved}/{len(data)} records for {symbol}'))
    
    def clean_decimal(self, value):
        """Clean and convert to Decimal"""
        if not value or value.strip().lower() in ('', 'n/a', 'na'):
            return None
        try:
            cleaned = value.replace(',', '').replace(' ', '').strip()
            return Decimal(cleaned)
        except:
            return None
    
    def clean_int(self, value):
        """Clean and convert to int"""
        if not value or value.strip().lower() in ('', 'n/a', 'na'):
            return 0
        try:
            cleaned = value.replace(',', '').replace(' ', '').strip()
            return int(float(cleaned))
        except:
            return 0
    
    def handle_alert(self, driver):
        """Handle popup alerts"""
        try:
            WebDriverWait(driver, 2).until(EC.alert_is_present())
            alert = driver.switch_to.alert
            alert.dismiss()
        except:
            pass
    
    def is_last_page(self, driver):
        """Check if on last page"""
        try:
            next_button = driver.find_element(By.XPATH, "//a[@title='Next Page']")
            return "disabled" in next_button.get_attribute("class")
        except:
            return True
    
    def click_next_page(self, driver):
        """Navigate to next page"""
        try:
            next_button = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//a[@title='Next Page']"))
            )
            onclick_js = next_button.get_attribute("onclick")
            if onclick_js:
                driver.execute_script(onclick_js)
                time.sleep(2)
                return True
        except:
            return False