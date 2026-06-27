from celery import Celery
import os
from celery.schedules import crontab

broker = os.getenv("REDIS_URL", "redis://redis:6379/0")
app = Celery("soul_sync_worker", broker=broker)

# Configure Celery priority queues
app.conf.task_queues = {
    'default': {
        'exchange': 'default',
        'routing_key': 'default',
    },
    'critical': {
        'exchange': 'critical',
        'routing_key': 'critical',
    }
}

app.conf.task_default_queue = 'default'
app.conf.task_default_exchange = 'default'
app.conf.task_default_routing_key = 'default'

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
    'monitor-user-risks': {
        'task': 'app.tasks.risk_monitor_worker.monitor_user_risks',
        'schedule': crontab(minute='*/240'),  # Run every 4 hours
    },
}

app.conf.timezone = 'UTC'


@app.task
def ping():
    return "pong"
