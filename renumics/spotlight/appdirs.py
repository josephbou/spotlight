"""
Module managing different application directories (config, cache, temp,...)
"""

import os
from pathlib import Path

import appdirs

_APP_NAME = "spotlight"
_APP_AUTHOR = "renumics"

config_dir = Path(appdirs.user_config_dir(_APP_NAME, _APP_AUTHOR))

# Allow cache directory override via environment variable
_cache_dir_env = os.environ.get("SPOTLIGHT_CACHE_DIR")
cache_dir = (
    Path(_cache_dir_env)
    if _cache_dir_env
    else Path(appdirs.user_cache_dir(_APP_NAME, _APP_AUTHOR))
)
