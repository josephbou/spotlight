"""
Taks for dimensionality reduction
"""

import hashlib
import json
from typing import List, Tuple, cast

import numpy as np
import pandas as pd

from renumics.spotlight import dtypes
from renumics.spotlight.cache import reduction_cache
from renumics.spotlight.data_store import DataStore
from renumics.spotlight.logging import logger

SEED = 42


class ColumnNotEmbeddable(Exception):
    """
    The column is not embeddable
    """


def align_data(
    data_store: DataStore, column_names: List[str], indices: List[int]
) -> Tuple[np.ndarray, List[int]]:
    """
    Align data from table's columns, remove `NaN`'s.
    """
    from sklearn import preprocessing

    if not column_names or not indices:
        return np.empty(0, np.float64), []

    aligned_values = []
    for column_name in column_names:
        dtype = data_store.dtypes[column_name]
        column_values = data_store.get_converted_values(column_name, indices)
        if dtypes.is_embedding_dtype(dtype):
            embedding_length = max(
                0 if x is None else len(cast(np.ndarray, x)) for x in column_values
            )
            if embedding_length:
                none_replacement = np.full(embedding_length, np.nan)
                aligned_values.append(
                    np.array(
                        [
                            value if value is not None else none_replacement
                            for value in column_values
                        ]
                    )
                )
        elif dtypes.is_category_dtype(dtype):
            na_mask = np.array(column_values) == -1
            one_hot_values = preprocessing.label_binarize(
                column_values,
                classes=sorted(set(column_values).difference({-1})),  # type: ignore
            ).astype(float)
            one_hot_values[na_mask] = np.nan
            aligned_values.append(one_hot_values)
        elif dtypes.is_scalar_dtype(dtype):
            aligned_values.append(np.array(column_values, dtype=float))
        else:
            raise ColumnNotEmbeddable(
                f"Column '{column_name}' of type {dtype} is not embeddable."
            )

    data = np.hstack([col.reshape((len(indices), -1)) for col in aligned_values])
    mask = ~pd.isna(data).any(axis=1)
    return data[mask], (np.array(indices)[mask]).tolist()


def compute_cache_key(
    embedding_sample: np.ndarray,
    generation_id: int,
    column_names: List[str],
    indices: List[int],
    method: str,
    **kwargs: object,
) -> str:
    """
    Generate stable cache key for reduction computation.

    Args:
        embedding_sample: First embedding of the data store
        generation_id: Dataset version/generation
        column_names: Columns used for reduction
        indices: Row indices (will be sorted for stability)
        method: "umap" or "pca"
        **kwargs: Method-specific params (n_neighbors, metric, min_dist for UMAP;
                  normalization for PCA)

    Returns:
        64-character hex string (SHA256)
    """
    # Create stable representation
    cache_params = {
        "embedding_sample": embedding_sample.tolist(),
        "generation_id": generation_id,
        "columns": sorted(column_names),  # Sort for stability
        "indices": sorted(indices),  # Sort for stability
        "method": method,
        **kwargs,  # Unpack method-specific params
    }

    # JSON with sorted keys for stability
    params_json = json.dumps(cache_params, sort_keys=True)

    # SHA256 hash
    return hashlib.sha256(params_json.encode()).hexdigest()


def compute_umap(
    data_store: DataStore,
    column_names: List[str],
    indices: List[int],
    n_neighbors: int,
    metric: str,
    min_dist: float,
) -> Tuple[np.ndarray, List[int]]:
    """
    Prepare data from table and compute U-Map on them.
    """

    logger.debug("Aligning data for UMAP computation...")
    data, indices = align_data(data_store, column_names, indices)

    if data.size == 0:
        return np.empty(0, np.float64), []

    from sklearn import preprocessing

    if metric in ("standardized euclidean", "robust euclidean"):
        logger.debug(f"Preprocessing data for {metric} metric...")

    if metric == "standardized euclidean":
        data = preprocessing.StandardScaler(copy=False).fit_transform(data)
        metric = "euclidean"
    elif metric == "robust euclidean":
        data = preprocessing.RobustScaler(copy=False).fit_transform(data)
        metric = "euclidean"
    if data.shape[1] == 2:
        return data, indices

    import umap

    logger.debug("Computing UMAP embeddings...")
    embeddings = umap.UMAP(
        n_neighbors=n_neighbors,
        metric=metric,
        min_dist=min_dist,
        random_state=SEED,
        low_memory=False,
    ).fit_transform(data)
    return cast(np.ndarray, embeddings), indices


def compute_pca(
    data_store: DataStore,
    column_names: List[str],
    indices: List[int],
    normalization: str,
) -> Tuple[np.ndarray, List[int]]:
    """
    Prepare data from table and compute PCA on them.
    """

    logger.debug("Aligning data for PCA computation...")
    data, indices = align_data(data_store, column_names, indices)

    if data.size == 0:
        return np.empty(0, np.float64), []

    from sklearn import decomposition, preprocessing

    if normalization in ("standardize", "robust standardize"):
        logger.debug(f"Preprocessing data for {normalization} metric...")

    if data.shape[1] == 1:
        return np.hstack((data, np.zeros_like(data))), indices
    if normalization == "standardize":
        data = preprocessing.StandardScaler(copy=False).fit_transform(data)
    elif normalization == "robust standardize":
        data = preprocessing.RobustScaler(copy=False).fit_transform(data)

    logger.debug("Computing PCA embeddings...")
    reducer = decomposition.PCA(n_components=2, copy=False, random_state=SEED)
    # `fit_transform` returns Fortran-ordered array.
    embeddings = np.ascontiguousarray(reducer.fit_transform(data))
    return embeddings, indices


def compute_umap_cached(
    data_store: DataStore,
    column_names: List[str],
    indices: List[int],
    n_neighbors: int,
    metric: str,
    min_dist: float,
) -> Tuple[np.ndarray, List[int]]:
    """
    Compute UMAP with caching.

    Args:
        data_store: DataStore instance
        column_names: Columns to reduce
        indices: Row indices to include
        n_neighbors: Number of neighbors for UMAP
        metric: Distance metric
        min_dist: Minimum distance for UMAP

    Returns:
        Tuple of (embeddings, valid_indices)
    """
    # Generate cache key
    cache_key = compute_cache_key(
        embedding_sample=data_store.get_converted_value(column_names[0], 0),
        generation_id=data_store.generation_id,
        column_names=column_names,
        indices=indices,
        method="umap",
        n_neighbors=n_neighbors,
        metric=metric,
        min_dist=round(min_dist, 3),  # Avoid float precision issues
    )

    # Check cache
    cached_result = reduction_cache.get(cache_key)
    if cached_result is not None:
        logger.debug(
            f"UMAP cache hit for {len(indices)} rows, "
            f"{len(column_names)} columns, key={cache_key[:8]}..."
        )
        return cached_result

    # Compute if not cached
    logger.debug(
        f"UMAP cache miss - computing for {len(indices)} rows, "
        f"{len(column_names)} columns, key={cache_key[:8]}..."
    )
    result = compute_umap(
        data_store, column_names, indices, n_neighbors, metric, min_dist
    )

    # Store in cache
    reduction_cache[cache_key] = result

    return result


def compute_pca_cached(
    data_store: DataStore,
    column_names: List[str],
    indices: List[int],
    normalization: str,
) -> Tuple[np.ndarray, List[int]]:
    """
    Compute PCA with caching.

    Args:
        data_store: DataStore instance
        column_names: Columns to reduce
        indices: Row indices to include
        normalization: Normalization method (none, standardize, robust standardize)

    Returns:
        Tuple of (embeddings, valid_indices)
    """
    # Generate cache key
    cache_key = compute_cache_key(
        embedding_sample=data_store.get_converted_value(column_names[0], 0),
        generation_id=data_store.generation_id,
        column_names=column_names,
        indices=indices,
        method="pca",
        normalization=normalization,
    )

    # Check cache
    cached_result = reduction_cache.get(cache_key)
    if cached_result is not None:
        logger.debug(
            f"PCA cache hit for {len(indices)} rows, "
            f"{len(column_names)} columns, key={cache_key[:8]}..."
        )
        return cached_result

    # Compute if not cached
    logger.debug(
        f"PCA cache miss - computing for {len(indices)} rows, "
        f"{len(column_names)} columns, key={cache_key[:8]}..."
    )
    result = compute_pca(data_store, column_names, indices, normalization)

    # Store in cache
    reduction_cache[cache_key] = result

    return result
