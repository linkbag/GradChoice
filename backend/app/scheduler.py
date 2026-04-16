from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.database import SessionLocal
from app.services.analytics import refresh_stats_snapshot
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def _run_refresh():
    db = SessionLocal()
    try:
        snapshot = refresh_stats_snapshot(db)
        logger.info(f"Stats snapshot refreshed at {snapshot.last_refreshed}")
    except Exception as e:
        logger.error(f"Stats snapshot refresh failed: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(
        _run_refresh,
        CronTrigger(hour=0, minute=0),  # midnight UTC daily
        id="daily_stats_refresh",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Stats refresh scheduler started (daily at 00:00 UTC)")


def stop_scheduler():
    scheduler.shutdown(wait=False)
