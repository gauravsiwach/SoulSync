from celery import Celery
import os

broker = os.getenv("REDIS_URL", "redis://redis:6379/0")
app = Celery("soul_sync_worker", broker=broker)


@app.task
def ping():
    return "pong"
