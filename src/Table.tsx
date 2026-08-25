import { Fragment, type CSSProperties } from "react";
import "./Table.css";

export function Table(props: {
  columns: string[];
  dataColumnWidths: string;
  rows: string[][];
  onChangeCell: (row: number, col: number, value: string) => void;
  onDeleteRow: (row: number) => void;
  onAddRow: () => void;
  cellClassName?: (row: number, col: number, value: string) => string;
  cellStyle?: (
    row: number,
    col: number,
    value: string,
  ) => CSSProperties | undefined;
  onFocusCell?: (row: number, col: number) => void;
  onFocusDeleteRow?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const {
    columns,
    dataColumnWidths,
    rows,
    onChangeCell,
    onDeleteRow,
    onAddRow,
    cellClassName,
    cellStyle,
    onFocusCell,
    onFocusDeleteRow,
    ref,
  } = props;

  return (
    <div
      className="table"
      ref={ref}
      style={{ gridTemplateColumns: `${dataColumnWidths} 20px` }}
    >
      {columns.map((col, i) => (
        <div key={i} className="table-header">
          {col}
        </div>
      ))}
      <button className="table-header table-delete" onClick={onAddRow}>
        +
      </button>
      {rows.map((row, r) => (
        <Fragment key={r}>
          {row.map((value, c) => (
            <input
              key={c}
              className={`table-cell ${cellClassName?.(r, c, value) ?? ""}`}
              style={cellStyle?.(r, c, value)}
              value={value}
              onFocus={() => onFocusCell?.(r, c)}
              onChange={(e) => onChangeCell(r, c, e.currentTarget.value)}
            />
          ))}
          <button
            className="table-cell table-delete"
            onFocus={onFocusDeleteRow}
            onClick={() => onDeleteRow(r)}
          >
            x
          </button>
        </Fragment>
      ))}
    </div>
  );
}
