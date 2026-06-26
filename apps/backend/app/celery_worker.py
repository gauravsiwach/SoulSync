from celery import Celery
import os
from celery.schedules import crontab

broker = os.getenv("REDIS_URL", "redis://redis:6379/0")
app = Celery("soul_sync_worker", broker=broker)

# Configure Celery beat schedule
app.conf.beat_schedule = {
    'generate-daily-insights': {
        'task': 'generate_daily_insights',
        'schedule': crontab(hour=8, minute=0),  # Run daily at 8 AM
    },
    'check-stale-goals': {
        'task': 'check_stale_goals',
        'schedule': crontab(hour=10, minute=0),  # Run daily at 10 AM
    },
}

app.conf.timezone = 'UTC'


@app.task
def ping():
    return "pong"
