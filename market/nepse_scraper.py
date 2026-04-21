"""NEPSE Index scraper for fetching index data from Merolagani"""

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from django.utils import timezone
from decimal import Decimal
import logging
import re
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

MEROLAGANI_INDICES_URL = "https://merolagani.com/Indices.aspx"


# ---------------------------------------------------------------------------
# Browser helpers
# ---------------------------------------------------------------------------

def _make_driver():
    """Create and return a configured headless Chrome driver."""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_experimental_option(
        "prefs", {"profile.default_content_setting_values.notifications": 2}
    )
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options,
    )
    return driver


def _dismiss_alert(driver):
    """Silently dismiss any open browser alert. Returns True if one was dismissed."""
    try:
        alert = driver.switch_to.alert
        text = alert.text
        alert.dismiss()
        logger.info(f"Dismissed alert: {text}")
        time.sleep(0.5)
        return True
    except Exception:
        return False


def _wait_for_table(driver, timeout=30):
    """Wait until a <table> element is present in the DOM."""
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "table"))
        )
        logger.info("Table loaded successfully")
    except Exception as e:
        logger.warning(f"Timeout waiting for table: {e}")


def _load_page(driver):
    """Navigate to Merolagani indices page and wait for it to settle."""
    driver.get(MEROLAGANI_INDICES_URL)
    _wait_for_table(driver)
    time.sleep(3)  # let JS render fully
    _dismiss_alert(driver)


# ---------------------------------------------------------------------------
# Data parsing helpers
# ---------------------------------------------------------------------------

DATE_FORMATS = ["%Y/%m/%d", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]


def _parse_decimal(text):
    """Parse decimal value from text, handling commas and parentheses."""
    try:
        text = text.strip().replace(",", "").replace("(", "").replace(")", "").replace("%", "")
        if not text or text in ("-", ""):
            return None
        return Decimal(text)
    except Exception:
        return None


def _parse_int(text):
    """Parse integer value from text, handling commas."""
    try:
        text = text.strip().replace(",", "")
        if not text or text in ("-", ""):
            return None
        return int(text)
    except Exception:
        return None


def _parse_date(date_str):
    """Try multiple date formats and return a date object, or None."""
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def _build_record(date_str, value_text, change_text=None, pct_text=None):
    """
    Build a data record dict from raw cell text.
    Returns None if date or value cannot be parsed.
    """
    value = _parse_decimal(value_text)
    if value is None:
        logger.warning(f"Could not parse value: '{value_text}'")
        return None

    date_obj = _parse_date(date_str)
    if date_obj is None:
        logger.warning(f"Could not parse date: '{date_str}'")
        return None

    return {
        "timestamp": timezone.make_aware(datetime.combine(date_obj, datetime.min.time())),
        "value": value,
        "open": None,
        "high": None,
        "low": None,
        "turnover": None,
        "transactions": None,
        "shares": None,
        "volume": 0,
        "is_minute_data": False,
    }


# ---------------------------------------------------------------------------
# Core row extraction  (reads the whole page at once — no per-row DOM queries)
# ---------------------------------------------------------------------------

def _extract_page_rows(driver):
    """
    Extract ALL data rows from the table currently visible in the browser.

    Key fix vs original:
      - Dismiss alert BEFORE touching the DOM (and actually call .dismiss()).
      - Snapshot all <tr> elements into a list ONCE.
      - Iterate over the snapshot; never re-query the table mid-loop.
      - Return a (list_of_records, first_date_str) tuple so the caller can
        detect page changes without a second DOM read.
    """
    _dismiss_alert(driver)

    data = []
    first_date_str = None

    try:
        table = driver.find_element(By.TAG_NAME, "table")
        tbody = table.find_element(By.TAG_NAME, "tbody")
        rows = tbody.find_elements(By.TAG_NAME, "tr")   # snapshot once
        logger.info(f"Found {len(rows)} rows in table")

        for i, row in enumerate(rows):
            try:
                cells = row.find_elements(By.TAG_NAME, "td")

                if len(cells) < 3:
                    logger.debug(f"Row {i}: only {len(cells)} cells, skipping")
                    continue

                # Merolagani columns: SN | Date (AD) | Index | Abs Change | % Change
                date_str    = cells[1].text.strip()
                value_text  = cells[2].text.strip()
                change_text = cells[3].text.strip() if len(cells) > 3 else None
                pct_text    = cells[4].text.strip() if len(cells) > 4 else None

                record = _build_record(date_str, value_text, change_text, pct_text)
                if record:
                    data.append(record)
                    if first_date_str is None:
                        first_date_str = date_str

            except Exception as e:
                logger.error(f"Error processing row {i}: {e}")
                continue

    except Exception as e:
        logger.error(f"Error finding table on page: {e}")
        import traceback
        logger.error(traceback.format_exc())

    logger.info(f"Extracted {len(data)} valid records from current page")
    return data, first_date_str


# ---------------------------------------------------------------------------
# Pagination helper
# ---------------------------------------------------------------------------

NEXT_BUTTON_XPATHS = [
    "//a[contains(@class,'next') and not(contains(@class,'disabled'))]",
    "//a[normalize-space(text())='Next' and not(contains(@class,'disabled'))]",
    "//li[contains(@class,'next') and not(contains(@class,'disabled'))]/a",
    "//a[@id='Next' and not(contains(@class,'disabled'))]",
    "//span[normalize-space(text())='Next']/parent::a[not(contains(@class,'disabled'))]",
    "//a[contains(@aria-label,'Next') and not(contains(@class,'disabled'))]",
]


def _find_next_button(driver):
    """Return the Next pagination button if it exists and is usable, else None."""
    for xpath in NEXT_BUTTON_XPATHS:
        try:
            btn = driver.find_element(By.XPATH, xpath)
            if btn.is_displayed() and btn.is_enabled():
                logger.debug(f"Next button found via: {xpath}")
                return btn
        except Exception:
            continue
    return None


def _click_next_page(driver, current_first_date):
    """
    Click the Next button and verify the page actually changed.

    Returns True if navigation succeeded, False otherwise.
    """
    _dismiss_alert(driver)

    btn = _find_next_button(driver)
    if btn is None:
        logger.info("Next button not found or disabled — pagination complete")
        return False

    try:
        onclick = btn.get_attribute("onclick")
        if onclick:
            logger.info(f"Executing onclick JS: {onclick}")
            driver.execute_script(onclick)
        else:
            driver.execute_script("arguments[0].click();", btn)

        _dismiss_alert(driver)
        time.sleep(3)

        # Confirm the table actually changed by checking the first date cell
        try:
            first_cell = driver.find_element(
                By.CSS_SELECTOR, "table tbody tr:first-child td:nth-child(2)"
            )
            new_first_date = first_cell.text.strip()
        except Exception:
            logger.warning("Could not read first cell after click")
            return False

        if new_first_date == current_first_date:
            logger.warning(
                f"First date unchanged ({current_first_date}) — pagination stopped"
            )
            return False

        logger.info(
            f"Page changed: first date {current_first_date!r} → {new_first_date!r}"
        )

        # Wait for table to settle after page change
        _wait_for_table(driver, timeout=10)
        return True

    except Exception as e:
        logger.error(f"Error clicking Next button: {e}")
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scrape_nepse_index():
    """
    Scrape the most recent NEPSE index row from Merolagani.
    Returns a single record dict, or None on failure.
    """
    driver = None
    try:
        driver = _make_driver()
        _load_page(driver)

        data, _ = _extract_page_rows(driver)

        if data:
            return data[0]

        logger.error("Failed to scrape NEPSE index from Merolagani — no rows extracted")
        return None

    except Exception as e:
        logger.error(f"Error scraping NEPSE index: {e}")
        return None

    finally:
        if driver:
            driver.quit()


def scrape_nepse_index_historical(days=30):
    """
    Scrape historical NEPSE index data from Merolagani with full pagination.

    The `days` parameter is advisory; actual cutoff logic should be applied
    by the caller after this function returns all available records.

    Returns a list of record dicts (newest first, matching website order).
    """
    driver = None
    try:
        driver = _make_driver()
        _load_page(driver)

        all_data = []
        current_page = 1
        MAX_PAGES = 1000  # safety ceiling

        while current_page <= MAX_PAGES:
            logger.info(f"Scraping page {current_page} …")

            page_data, first_date = _extract_page_rows(driver)
            all_data.extend(page_data)

            if not page_data:
                logger.warning("No data on this page, stopping pagination")
                break

            if not _click_next_page(driver, first_date):
                break

            current_page += 1

        logger.info(f"Scraped {len(all_data)} historical NEPSE index records total")
        return all_data

    except Exception as e:
        logger.error(f"Error scraping historical NEPSE index: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []

    finally:
        if driver:
            driver.quit()


# ---------------------------------------------------------------------------
# Regex / DOM fallback helpers  (kept for completeness)
# ---------------------------------------------------------------------------

def _extract_from_page_source(page_source):
    """Extract index value from page source using regex."""
    patterns = [
        r"NEPSE\s*[:\-]?\s*([\d,]+\.?\d*)",
        r"Index\s*[:\-]?\s*([\d,]+\.?\d*)",
        r"nepse-index[^>]*>([\d,]+\.?\d*)",
        r"index-value[^>]*>([\d,]+\.?\d*)",
        r"market-index[^>]*>([\d,]+\.?\d*)",
        r"indexValue[^>]*>([\d,]+\.?\d*)",
        r"index_number[^>]*>([\d,]+\.?\d*)",
        r"share-index[^>]*>([\d,]+\.?\d*)",
        r"nepseIndex[^>]*>([\d,]+\.?\d*)",
        r'class="[^"]*index[^"]*"[^>]*>([\d,]+\.?\d*)',
        r"data-index[^>]*>([\d,]+\.?\d*)",
    ]
    for pattern in patterns:
        for match in re.findall(pattern, page_source, re.IGNORECASE):
            try:
                value = Decimal(match.replace(",", "").strip())
                if 1000 < value < 10000:
                    return value
            except Exception:
                continue
    return None


def _extract_from_dom(driver):
    """Extract index value from DOM elements using CSS/XPath selectors."""
    css_selectors = [
        ".nepse-index", ".index-value", "[data-index]",
        ".market-status .value", "#nepse-index", ".index",
        ".market-index", ".indexValue", ".index_number",
        "[class*='index']", ".share-index", ".nepseIndex",
        "[data-value]", "[class*='market']",
    ]
    for selector in css_selectors:
        try:
            element = driver.find_element(By.CSS_SELECTOR, selector)
            value = Decimal(element.text.replace(",", "").strip())
            if 1000 < value < 10000:
                return value
        except Exception:
            continue

    xpath_selectors = [
        "//div[contains(text(),'NEPSE')]",
        "//span[contains(@class,'index')]",
        "//*[contains(text(),'Index')]",
        "//div[contains(@class,'index')]",
        "//span[contains(@class,'market')]",
    ]
    for xpath in xpath_selectors:
        try:
            for element in driver.find_elements(By.XPATH, xpath):
                for num in re.findall(r"[\d,]+\.?\d*", element.text):
                    try:
                        value = Decimal(num.replace(",", "").strip())
                        if 1000 < value < 10000:
                            return value
                    except Exception:
                        continue
        except Exception:
            continue

    return None


def _extract_from_pattern(page_source):
    """Extract index value using numeric pattern matching."""
    for num in re.findall(r"(\d{4}\.\d{2})", page_source):
        try:
            value = Decimal(num)
            if 1800 < value < 2500:
                return value
        except Exception:
            continue
    return None


# ---------------------------------------------------------------------------
# Test / diagnostic entry point
# ---------------------------------------------------------------------------

def test_nepse_scraper():
    """Test function to diagnose NEPSE scraping issues."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )

    print("=" * 60)
    print("Testing NEPSE Index Scraper")
    print("=" * 60)

    print("\n1. Testing scrape_nepse_index() …")
    result = scrape_nepse_index()
    if result:
        print(f"   SUCCESS: value={result['value']}  timestamp={result['timestamp']}")
    else:
        print("   FAILED: could not scrape current index")

    print("\n2. Testing scrape_nepse_index_historical(days=30) …")
    historical = scrape_nepse_index_historical(days=30)
    if historical:
        print(f"   SUCCESS: {len(historical)} records")
        print(f"   First : {historical[0]['timestamp']}  {historical[0]['value']}")
        print(f"   Last  : {historical[-1]['timestamp']}  {historical[-1]['value']}")
    else:
        print("   FAILED: could not scrape historical data")

    print("\n" + "=" * 60)
    print("Test complete")
    print("=" * 60)

    return {
        "current": result,
        "historical_count": len(historical) if historical else 0,
        "historical_sample": historical[:5] if historical else [],
    }


if __name__ == "__main__":
    test_nepse_scraper()