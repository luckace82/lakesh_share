import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lakesh_share.settings')

app = Celery('lakesh_share')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Celery beat schedule for automatic tasks
app.conf.beat_schedule = {
    'scrape-nepse-index-daily': {
        'task': 'market.scraper_tasks.auto_scrape_nepse_index',
        'schedule': crontab(hour=16, minute=30),  # 4:30 PM daily (NEPSE closing time)
        'options': {'queue': 'scraping'}
    },
    'update-stock-indicators': {
        'task': 'market.scraper_tasks.update_stock_indicators',
        'schedule': crontab(hour=17, minute=0),  # 5:00 PM daily (after market close)
        'options': {'queue': 'indicators'}
    },
    'generate-nepse-insights': {
        'task': 'market.scraper_tasks.generate_daily_insights',
        'schedule': crontab(hour=17, minute=15),  # 5:15 PM daily
        'options': {'queue': 'ai'}
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
