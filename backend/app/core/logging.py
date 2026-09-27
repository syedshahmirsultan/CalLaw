"""Structured logging setup for CalLaw."""

import logging
import sys


def setup_logging(debug: bool = True) -> logging.Logger:
    """Set up and configure the application logger."""
    log_level = logging.DEBUG if debug else logging.INFO

    logger = logging.getLogger("callaw")
    logger.setLevel(log_level)

    # Avoid duplicate handlers if already configured
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(log_level)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
