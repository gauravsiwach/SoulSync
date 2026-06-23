import logging
import structlog
import sys
from typing import Any, Dict
from datetime import datetime

def configure_logging(log_level: str = "INFO") -> None:
    """Configure structured logging for the application"""
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance"""
    return structlog.get_logger(name)

class LoggingMixin:
    """Mixin class to add logging capabilities to any class"""
    
    @property
    def logger(self) -> structlog.stdlib.BoundLogger:
        """Get logger for this class"""
        return get_logger(self.__class__.__name__)

def log_function_call(func_name: str, args: tuple = (), kwargs: Dict[str, Any] = None) -> None:
    """Log function call details"""
    logger = get_logger("function_calls")
    logger.info(
        "function_called",
        function=func_name,
        args_count=len(args),
        kwargs_keys=list(kwargs.keys() if kwargs else []),
    )

def log_api_request(method: str, path: str, user_id: str = None, **extra) -> None:
    """Log API request details"""
    logger = get_logger("api_requests")
    logger.info(
        "api_request",
        method=method,
        path=path,
        user_id=user_id,
        **extra
    )

def log_api_response(method: str, path: str, status_code: int, duration_ms: float, **extra) -> None:
    """Log API response details"""
    logger = get_logger("api_responses")
    logger.info(
        "api_response",
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=duration_ms,
        **extra
    )

def log_ai_request(user_id: str, provider: str, model: str, message_length: int) -> None:
    """Log AI request details"""
    logger = get_logger("ai_requests")
    logger.info(
        "ai_request",
        user_id=user_id,
        provider=provider,
        model=model,
        message_length=message_length,
    )

def log_ai_response(user_id: str, provider: str, response_length: int, duration_ms: float) -> None:
    """Log AI response details"""
    logger = get_logger("ai_responses")
    logger.info(
        "ai_response",
        user_id=user_id,
        provider=provider,
        response_length=response_length,
        duration_ms=duration_ms,
    )

def log_database_operation(operation: str, table: str, duration_ms: float, **extra) -> None:
    """Log database operation details"""
    logger = get_logger("database_operations")
    logger.info(
        "database_operation",
        operation=operation,
        table=table,
        duration_ms=duration_ms,
        **extra
    )

def log_redis_operation(operation: str, key: str, duration_ms: float, **extra) -> None:
    """Log Redis operation details"""
    logger = get_logger("redis_operations")
    logger.info(
        "redis_operation",
        operation=operation,
        key=key,
        duration_ms=duration_ms,
        **extra
    )

def log_error(error: Exception, context: Dict[str, Any] = None) -> None:
    """Log error with context"""
    logger = get_logger("errors")
    logger.error(
        "error_occurred",
        error_type=type(error).__name__,
        error_message=str(error),
        context=context or {},
        exc_info=True,
    )
