import requests
from bs4 import BeautifulSoup
from decimal import Decimal
import time
import logging
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


class ShareSansarScraper:
    """Scrapes from sharesansar.com"""
    
    BASE_URL = "https://www.sharesansar.com"
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)
    
    def scrape_market_data(self):
        """Scrape all stocks from live trading page"""
        url = f"{self.BASE_URL}/live-trading"
        
        try:
            print("Fetching live data from ShareSansar...")
            time.sleep(1)
            response = self.session.get(url, timeout=15, verify=False)
            
            if response.status_code != 200:
                print(f"Failed: Status {response.status_code}")
                return []
            
            soup = BeautifulSoup(response.content, 'lxml')
            
            # Find the table
            table = soup.find('table', {'id': 'headFixed'})
            if not table:
                table = soup.find('table', class_='table')
            
            if not table:
                print("Table not found")
                return []
            
            tbody = table.find('tbody')
            if not tbody:
                print("Table body not found")
                return []
            
            rows = tbody.find_all('tr')
            print(f"Found {len(rows)} stocks")
            
            stocks = []
            
            for row in rows:
                try:
                    cols = row.find_all('td')
                    
                    if len(cols) < 10:
                        continue
                    
                    # Parse according to the column structure we found
                    stock_data = {
                        'symbol': cols[1].text.strip(),
                        'ltp': self._to_decimal(cols[2]),
                        'change': self._to_decimal(cols[3]),
                        'change_percent': self._to_decimal(cols[4]),
                        'open': self._to_decimal(cols[5]),
                        'high': self._to_decimal(cols[6]),
                        'low': self._to_decimal(cols[7]),
                        'volume': self._to_int(cols[8]),
                        'prev_close': self._to_decimal(cols[9]),
                    }
                    
                    # Only add if we have essential data
                    if stock_data['symbol'] and stock_data['ltp']:
                        stocks.append(stock_data)
                    
                except Exception as e:
                    logger.warning(f"Error parsing row: {e}")
                    continue
            
            print(f"Successfully parsed {len(stocks)} stocks")
            return stocks
            
        except Exception as e:
            logger.error(f"Scraping failed: {e}")
            return []
    
    def _to_decimal(self, element):
        try:
            text = element.text.strip().replace(',', '')
            if not text or text == '-' or text == '':
                return None
            return Decimal(text)
        except:
            return None
    
    def _to_int(self, element):
        try:
            text = element.text.strip().replace(',', '')
            if not text or text == '-' or text == '':
                return 0
            return int(float(text))  # Handle decimals like 3,683.00
        except:
            return 0