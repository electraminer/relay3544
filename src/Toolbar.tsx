import { useState } from "react";
import "./Toolbar.css";
import "material-symbols/outlined.css";
import { Sender } from "./Chat";
import { TooltipWrap } from "./Tooltip";
import type { Relay } from "./useRelaySocket";
import type { DictEntry } from "./Dictionary";
import type { AudioPlayer } from "./AudioPlayer";

export function Toolbar(props: {
  relay: Relay;
  dictOpen: boolean;
  onToggleDict: () => void;
  imageOpen: boolean;
  onToggleImage: () => void;
  dictionary: Map<number, DictEntry>;
  audio: AudioPlayer;
}) {
  const { relay, dictOpen, onToggleDict, imageOpen, onToggleImage } = props;
  const { code, online, join, soundEnabled, setSoundEnabled } = relay;
  const [codeField, setCodeField] = useState(code.toString());

  return (
    <div className="toolbar-bar">
      <button
        className={`toolbar-sidebar-toggle
          ${dictOpen ? "" : "toolbar-sidebar-toggle--closed"}`}
        title={dictOpen ? "Hide dictionary" : "Show dictionary"}
        onClick={onToggleDict}
      >
        <span className="material-symbols-outlined">dictionary</span>
      </button>
      <div className="toolbar-separator" />
      <span className="toolbar-title">Relay3544</span>
      <a
        className="social"
        href="https://store.steampowered.com/app/4080030/The_Message_from_Deep_Space/"
      >
        <img src="/Steam_icon_logo.svg" />
      </a>
      <div className="toolbar-spacer" />
      {props.audio.currentSongId ? (
        <button
          className={`toolbar-sidebar-toggle
            ${soundEnabled ? "" : "toolbar-sidebar-toggle--closed"}`}
          title={"Music currently playing"}
          onClick={() => props.audio.stop()}
        >
          <span className="material-symbols-outlined">music_note_2</span>
        </button>
      ) : (
        <button
          className={`toolbar-sidebar-toggle
            ${soundEnabled ? "" : "toolbar-sidebar-toggle--closed"}`}
          title={soundEnabled ? "Mute message sounds" : "Enable message sounds"}
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          <span className="material-symbols-outlined">
            {soundEnabled ? "volume_up" : "volume_off"}
          </span>
        </button>
      )}
      <input
        className="output-code"
        placeholder="0000"
        inputMode="numeric"
        spellCheck={false}
        autoComplete="off"
        maxLength={4}
        value={codeField}
        onChange={(e) => {
          setCodeField(e.currentTarget.value);
          join(parseInt(e.currentTarget.value));
        }}
      />
      <TooltipWrap
        tooltip={
          <>
            <div className="tooltip-title">Online</div>
            {online.length > 0 ? (
              online.map((id, i) => (
                <div className="tooltip-line" key={i}>
                  <Sender
                    sender={id}
                    key={i}
                    dictionary={props.dictionary}
                    audio={props.audio}
                  />
                </div>
              ))
            ) : (
              <div className="tooltip-empty">No one online</div>
            )}
          </>
        }
      >
        <div className="toolbar-online">
          <span>{online.length}</span>
          <span className="material-symbols-outlined">group</span>
        </div>
      </TooltipWrap>
      <div className="toolbar-separator" />
      <button
        className={`toolbar-sidebar-toggle ${imageOpen ? "" : "toolbar-sidebar-toggle--closed"}`}
        title={imageOpen ? "Hide image" : "Show image"}
        onClick={onToggleImage}
      >
        <span className="material-symbols-outlined">visibility</span>
      </button>
    </div>
  );
}
