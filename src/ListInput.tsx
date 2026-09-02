import {
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type MouseEventHandler,
} from "react";
import "./ListInput.css";
import { Icon } from "./atoms/Icon";

export function ListInput(props: {
  label: string;
  value: string[];
  itemStyle?: () => Record<string, any>;
  className?: string;
  itemClass?: string;
  buttonClass?: string;
  inputClass?: string;
  disabled?: boolean;
  onChange: (items: string[]) => void;
}) {
  const [newValue, setNewValue] = useState<string>("");

  function setItem(idx: number, value: string) {
    const prev = props.value.slice(0, idx);
    const after = props.value.slice(idx + 1);
    props.onChange([...prev, value, ...after]);
  }

  function addItem() {
    props.onChange([...props.value, newValue]);
    setNewValue("");
  }

  function removeItem(idx: number) {
    props.onChange([
      ...props.value.slice(0, idx),
      ...props.value.slice(idx + 1),
    ]);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>, i: number) {
    setItem(i, event.target.value);
  }

  return (
    <div className={`list-input ${props.className ?? ""}`}>
      <div className={`dict-editor-controls ${props.itemClass ?? ""}`}>
        <div className="dict-editor-format-label">{props.label}</div>
        <input
          className={` ${props.inputClass ?? ""}`}
          type="text"
          style={props.itemStyle?.()}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          disabled={props.disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Space") addItem();
          }}
        />
        <button
          className={`dict-editor-format-button ${props.buttonClass ?? ""}`}
          onClick={addItem}
          disabled={props.disabled}
        >
          <Icon name="add" />
        </button>
      </div>
      {props.value.map((value, i) => (
        <div className="dict-editor-controls" key={i}>
          <span className="dict-editor-format-label list-input-item-idx">
            {i}
          </span>
          <input
            className="dict-editor-format"
            type="text"
            style={props.itemStyle?.()}
            value={value}
            onChange={(e) => handleChange(e, i)}
            disabled={props.disabled}
          />
          <button
            className="dict-editor-format-button"
            onClick={() => removeItem(i)}
            disabled={props.disabled}
          >
            <Icon name="clear" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Chip(props: {
  value: string;
  onRemove?: MouseEventHandler;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div className="list-input-chip">
      <input
        type="text"
        className="list-input-chip-value"
        value={props.value}
        onChange={props.onChange}
      />
      <button
        className="list-input-chip-remove dict-editor-format-button"
        onClick={props.onRemove}
      >
        <span className="material-symbols-outlined">clear</span>
      </button>
    </div>
  );
}
