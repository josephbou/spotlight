"""
Tests for dimensionality reduction caching
"""

from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from renumics.spotlight.backend.tasks.reduction import (
    compute_cache_key,
    compute_pca_cached,
    compute_umap_cached,
)
from renumics.spotlight.cache import reduction_cache


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear reduction cache before and after each test"""
    reduction_cache.clear()
    yield
    reduction_cache.clear()


@pytest.fixture
def mock_data_store():
    """Create a mock DataStore for testing"""
    store = MagicMock()
    store.uid = "test-dataset-123"
    store.generation_id = 1
    return store


class TestCacheKeyGeneration:
    """Test cache key generation logic"""

    def test_same_inputs_same_key(self):
        """Same inputs should produce same cache key"""
        key1 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1", "col2"],
            indices=[0, 1, 2, 3],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        key2 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1", "col2"],
            indices=[0, 1, 2, 3],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        assert key1 == key2

    def test_column_order_independent(self):
        """Column order should not affect cache key (sorted internally)"""
        key1 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1", "col2"],
            indices=[0, 1, 2],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        key2 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col2", "col1"],
            indices=[0, 1, 2],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        assert key1 == key2

    def test_indices_order_independent(self):
        """Indices order should not affect cache key (sorted internally)"""
        key1 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1"],
            indices=[0, 1, 2, 3],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        key2 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1"],
            indices=[3, 1, 0, 2],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        assert key1 == key2

    def test_different_params_different_key(self):
        """Different parameters should produce different cache keys"""
        base_kwargs = {
            "data_store_uid": "dataset-1",
            "generation_id": 1,
            "column_names": ["col1"],
            "indices": [0, 1, 2],
            "method": "umap",
            "n_neighbors": 20,
            "metric": "euclidean",
            "min_dist": 0.15,
        }

        key_base = compute_cache_key(**base_kwargs)

        # Different n_neighbors
        key_diff_neighbors = compute_cache_key(**{**base_kwargs, "n_neighbors": 30})
        assert key_base != key_diff_neighbors

        # Different metric
        key_diff_metric = compute_cache_key(**{**base_kwargs, "metric": "cosine"})
        assert key_base != key_diff_metric

        # Different min_dist
        key_diff_min_dist = compute_cache_key(**{**base_kwargs, "min_dist": 0.25})
        assert key_base != key_diff_min_dist

    def test_generation_id_changes_key(self):
        """Different generation_id should produce different cache key"""
        key1 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1"],
            indices=[0, 1, 2],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        key2 = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=2,  # Different generation
            column_names=["col1"],
            indices=[0, 1, 2],
            method="umap",
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )
        assert key1 != key2

    def test_umap_vs_pca_different_keys(self):
        """UMAP and PCA should produce different cache keys"""
        key_umap = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1"],
            indices=[0, 1, 2],
            method="umap",
            n_neighbors=20,
        )
        key_pca = compute_cache_key(
            data_store_uid="dataset-1",
            generation_id=1,
            column_names=["col1"],
            indices=[0, 1, 2],
            method="pca",
            normalization="standardize",
        )
        assert key_umap != key_pca


class TestUMAPCaching:
    """Test UMAP caching behavior"""

    @patch("renumics.spotlight.backend.tasks.reduction.compute_umap")
    def test_cache_miss_calls_compute(self, mock_compute, mock_data_store):
        """First call should compute UMAP"""
        # Setup mock return value
        expected_result = (np.array([[1.0, 2.0], [3.0, 4.0]]), [0, 1])
        mock_compute.return_value = expected_result

        # Call cached version
        result = compute_umap_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0, 1],
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )

        # Verify compute was called
        assert mock_compute.call_count == 1
        # Verify result matches
        np.testing.assert_array_equal(result[0], expected_result[0])
        assert result[1] == expected_result[1]

    @patch("renumics.spotlight.backend.tasks.reduction.compute_umap")
    def test_cache_hit_skips_compute(self, mock_compute, mock_data_store):
        """Second call with same params should use cache"""
        # Setup mock return value
        expected_result = (np.array([[1.0, 2.0], [3.0, 4.0]]), [0, 1])
        mock_compute.return_value = expected_result

        # First call - cache miss
        result1 = compute_umap_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0, 1],
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )

        # Second call with same params - cache hit
        result2 = compute_umap_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0, 1],
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )

        # Verify compute was only called once
        assert mock_compute.call_count == 1
        # Verify results match
        np.testing.assert_array_equal(result1[0], result2[0])
        assert result1[1] == result2[1]

    @patch("renumics.spotlight.backend.tasks.reduction.compute_umap")
    def test_parameter_change_cache_miss(self, mock_compute, mock_data_store):
        """Changing parameters should cause cache miss"""
        # Setup mock return values
        result1_data = (np.array([[1.0, 2.0]]), [0])
        result2_data = (np.array([[3.0, 4.0]]), [0])
        mock_compute.side_effect = [result1_data, result2_data]

        # First call
        result1 = compute_umap_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0],
            n_neighbors=20,
            metric="euclidean",
            min_dist=0.15,
        )

        # Second call with different n_neighbors
        result2 = compute_umap_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0],
            n_neighbors=30,  # Changed parameter
            metric="euclidean",
            min_dist=0.15,
        )

        # Verify compute was called twice
        assert mock_compute.call_count == 2
        # Verify results are different
        assert not np.array_equal(result1[0], result2[0])


class TestPCACaching:
    """Test PCA caching behavior"""

    @patch("renumics.spotlight.backend.tasks.reduction.compute_pca")
    def test_cache_miss_calls_compute(self, mock_compute, mock_data_store):
        """First call should compute PCA"""
        # Setup mock return value
        expected_result = (np.array([[1.0, 2.0], [3.0, 4.0]]), [0, 1])
        mock_compute.return_value = expected_result

        # Call cached version
        result = compute_pca_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0, 1],
            normalization="standardize",
        )

        # Verify compute was called
        assert mock_compute.call_count == 1
        # Verify result matches
        np.testing.assert_array_equal(result[0], expected_result[0])
        assert result[1] == expected_result[1]

    @patch("renumics.spotlight.backend.tasks.reduction.compute_pca")
    def test_cache_hit_skips_compute(self, mock_compute, mock_data_store):
        """Second call with same params should use cache"""
        # Setup mock return value
        expected_result = (np.array([[1.0, 2.0], [3.0, 4.0]]), [0, 1])
        mock_compute.return_value = expected_result

        # First call - cache miss
        result1 = compute_pca_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0, 1],
            normalization="standardize",
        )

        # Second call with same params - cache hit
        result2 = compute_pca_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0, 1],
            normalization="standardize",
        )

        # Verify compute was only called once
        assert mock_compute.call_count == 1
        # Verify results match
        np.testing.assert_array_equal(result1[0], result2[0])
        assert result1[1] == result2[1]

    @patch("renumics.spotlight.backend.tasks.reduction.compute_pca")
    def test_normalization_change_cache_miss(self, mock_compute, mock_data_store):
        """Changing normalization should cause cache miss"""
        # Setup mock return values
        result1_data = (np.array([[1.0, 2.0]]), [0])
        result2_data = (np.array([[3.0, 4.0]]), [0])
        mock_compute.side_effect = [result1_data, result2_data]

        # First call
        result1 = compute_pca_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0],
            normalization="standardize",
        )

        # Second call with different normalization
        result2 = compute_pca_cached(
            data_store=mock_data_store,
            column_names=["col1"],
            indices=[0],
            normalization="robust standardize",  # Changed parameter
        )

        # Verify compute was called twice
        assert mock_compute.call_count == 2
        # Verify results are different
        assert not np.array_equal(result1[0], result2[0])
