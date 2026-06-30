"""Reusable headless Chrome driver pool for scraping tasks.

Eliminates the overhead of creating/destroying a Chrome instance per stock.
A pool of N drivers is maintained; tasks check one out, use it, and return it.
"""

import logging
import threading
from contextlib import contextmanager
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

logger = logging.getLogger(__name__)

# Cache the ChromeDriver path so we don't re-check the filesystem every time
_driver_path_cache = None
_driver_path_lock = threading.Lock()


def _get_driver_path():
    """Return the ChromeDriver path, caching the result after the first call."""
    global _driver_path_cache
    if _driver_path_cache is None:
        with _driver_path_lock:
            if _driver_path_cache is None:
                _driver_path_cache = ChromeDriverManager().install()
                logger.info(f"ChromeDriver cached at: {_driver_path_cache}")
    return _driver_path_cache


def _create_driver():
    """Create and return a configured headless Chrome driver."""
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_experimental_option(
        "prefs", {"profile.default_content_setting_values.notifications": 2}
    )
    driver = webdriver.Chrome(
        service=Service(_get_driver_path()),
        options=chrome_options,
    )
    driver.set_page_load_timeout(60)
    return driver


class BrowserPool:
    """Thread-safe pool of headless Chrome drivers.

    Usage:
        pool = BrowserPool(pool_size=3)
        with pool.get_driver() as driver:
            driver.get("https://example.com")
            ...
        # driver is returned to the pool automatically
        pool.shutdown()  # call when done to quit all drivers
    """

    def __init__(self, pool_size=2):
        self._pool_size = pool_size
        self._drivers = []
        self._available = []
        self._lock = threading.Lock()
        self._created = 0

    def _create_new_driver(self):
        """Create a new driver and track it."""
        driver = _create_driver()
        self._drivers.append(driver)
        self._created += 1
        logger.info(f"BrowserPool: created driver #{self._created} (total active: {len(self._drivers)})")
        return driver

    @contextmanager
    def get_driver(self):
        """Check out a driver from the pool. Returns it on context exit."""
        driver = None
        try:
            with self._lock:
                if self._available:
                    driver = self._available.pop()
                    logger.debug(f"BrowserPool: reusing cached driver")
                elif self._created < self._pool_size:
                    driver = self._create_new_driver()
                else:
                    # Pool exhausted — wait for one to become available
                    pass

            if driver is None:
                # Spin-wait briefly for a driver to become available
                # (In practice, Celery prefork workers are single-threaded per process)
                import time
                while driver is None:
                    with self._lock:
                        if self._available:
                            driver = self._available.pop()
                    if driver is None:
                        time.sleep(0.1)

            yield driver

        finally:
            if driver is not None:
                with self._lock:
                    self._available.append(driver)
                    logger.debug(f"BrowserPool: driver returned to pool")

    def shutdown(self):
        """Quit all drivers in the pool."""
        with self._lock:
            for driver in self._drivers:
                try:
                    driver.quit()
                except Exception as e:
                    logger.warning(f"BrowserPool: error quitting driver: {e}")
            self._drivers.clear()
            self._available.clear()
            self._created = 0
            logger.info("BrowserPool: all drivers shut down")


# Module-level singleton for use within a single Celery worker process
_singleton_pool = None
_singleton_lock = threading.Lock()


def get_pool(pool_size=2):
    """Return the module-level BrowserPool singleton, creating it if needed."""
    global _singleton_pool
    if _singleton_pool is None:
        with _singleton_lock:
            if _singleton_pool is None:
                _singleton_pool = BrowserPool(pool_size=pool_size)
                logger.info(f"BrowserPool singleton created (pool_size={pool_size})")
    return _singleton_pool


def shutdown_pool():
    """Shut down the module-level pool singleton."""
    global _singleton_pool
    if _singleton_pool is not None:
        _singleton_pool.shutdown()
        _singleton_pool = None
