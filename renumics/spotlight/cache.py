"""
Cache for backend files.
"""

from pathlib import Path
from sqlite3 import OperationalError
from typing import Any

import diskcache

from renumics.spotlight import appdirs


class Cache:
    """
    A simple wrapper around `diskcache.Cache`.
    """

    _dir: Path
    _cache: diskcache.Cache

    def __init__(self, name: str, size_limit: int = 2 * 2**30) -> None:
        """
        Initialize cache.

        Args:
            name: Cache name (subdirectory in cache dir)
            size_limit: Maximum cache size in bytes (default: 2GB)
        """
        self._dir = appdirs.cache_dir / name
        self._size_limit = size_limit
        self._cache = self._init_cache()

    def _init_cache(self) -> diskcache.Cache:
        return diskcache.Cache(
            str(self._dir),
            size_limit=self._size_limit,
            eviction_policy="least-recently-used",
        )

    def __getitem__(self, name: str) -> Any:
        try:
            return self._cache[name]
        except OperationalError:
            self._cache.close()
            self._cache = self._init_cache()
            return self._cache[name]

    def __setitem__(self, name: str, value: Any) -> None:
        try:
            self._cache[name] = value
        except OperationalError:
            self._cache.close()
            self._cache = self._init_cache()
            self._cache[name] = value

    def get(self, name: str, default: Any = None) -> Any:
        """
        Get value from cache with a default if not found.

        Args:
            name: Cache key
            default: Value to return if key not found

        Returns:
            Cached value or default
        """
        try:
            return self._cache[name]
        except KeyError:
            return default
        except OperationalError:
            self._cache.close()
            self._cache = self._init_cache()
            try:
                return self._cache[name]
            except KeyError:
                return default

    def clear(self) -> None:
        """
        Clear the whole cache.
        """
        self._cache.clear()


external_data_cache = Cache("external-data")
reduction_cache = Cache("reductions", size_limit=5 * 2**30)  # 5GB for large reductions


def clear(name: str) -> None:
    """
    Clear cache by its name.
    """
    cache = Cache(name)
    cache.clear()
