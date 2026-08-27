"""shared/utils/logger.py - 공통 로거 설정"""
import logging
import sys


def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """통일된 포맷의 로거를 생성합니다."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(
            "[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger
