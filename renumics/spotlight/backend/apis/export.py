"""
Export API
"""

import io
from typing import List

import pandas as pd
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()


class ExportRequest(BaseModel):
    indices: List[int]
    format: str = "csv"


@router.post("/export")
async def export_data(
    request: Request, export_request: ExportRequest
) -> StreamingResponse:
    """
    Export selected data as CSV or Pickle.
    """
    if request.app.data_store is None:
        return StreamingResponse(io.BytesIO(b""), media_type="text/csv")

    df = request.app.data_store.data_source.df
    indices = export_request.indices
    fmt = export_request.format

    if df is None:
        # Fallback if df is not directly available
        data = {}
        for col in request.app.data_store.column_names:
            values = request.app.data_store.data_source.get_column_values(col, indices)
            data[col] = list(values)
        df = pd.DataFrame(data)
    else:
        df = df.iloc[indices]

    stream = io.BytesIO()
    if fmt == "pickle":
        df.to_pickle(stream)
        media_type = "application/octet-stream"
        filename = "export.pkl"
    else:
        # CSV default
        # Use StringIO for CSV then encode to bytes
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        stream.write(csv_buffer.getvalue().encode("utf-8"))
        media_type = "text/csv"
        filename = "export.csv"

    stream.seek(0)
    response = StreamingResponse(
        stream,
        media_type=media_type,
    )
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response
