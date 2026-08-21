import { useRef, useState } from 'react';
import {
  Actions, BorderNode, DockLocation, Layout, Model,
  type IJsonModel, type ILayoutApi, type ITabRenderValues, type TabNode,
} from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';
import './App.css';
import { Toolbar } from './Toolbar';
import { RelayPane } from './Relay';
import { useRelaySocket } from './useRelaySocket';
import { Image, type Pixel } from './Image';
import { Dictionary, type DictEntry, type DictionaryHandle } from './Dictionary';
import { Text } from './Chat';

type ChatTabConfig = {
  channel: number | null,
};

const layoutJson: IJsonModel = {
  global: {
    tabEnableRename: false,
  },
  borders: [
    {
      type: 'border',
      location: 'left',
      size: 340,
      selected: 0,
      enableDrop: false,
      children: [
        { type: 'tab', 
        name: 'Dictionary',
        component: 'dictionary',
        enableClose: false,
        enableDrag:false },
      ],
    },
    {
      type: 'border',
      location: 'right',
      size: 300,
      selected: -1,
      enableDrop: false,
      children: [
        { type: 'tab',
          name: 'Image',
          component: 'image',
          enableClose: false,
          enableDrag: false },
      ],
    },
  ],
  layout: {
    type: 'row',
    children: [
      {
        type: 'tabset',
        children: [
          { id: "-111 -65535",
            type: 'tab',
            name: 'Message Chat',
            component: 'chat',
            enableClose: false,
            config: { channel: null } satisfies ChatTabConfig },
        ],
      },
    ],
  },
};

const LAYOUT_STORAGE_KEY = 'app-layout';

function loadLayoutJson(): IJsonModel {
  try {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (saved) return JSON.parse(saved) as IJsonModel;
  } catch (e) {
    console.error('Failed to load saved layout, using default', e);
  }
  return layoutJson;
}

function App() {
  const [{model, dictBorderId, imageBorderId, dictOpen: initialDictOpen, imageOpen: initialImageOpen}] = useState(() => {
    let model: Model;
    try {
      model = Model.fromJson(loadLayoutJson());
    } catch (e) {
      console.error('Failed to restore saved layout, using default', e);
      model = Model.fromJson(layoutJson);
    }
    let dictBorderId = '';
    let imageBorderId = '';
    let dictOpen = true;
    let imageOpen = false;
    model.visitNodes(node => {
      if (!(node instanceof BorderNode)) return;
      if (node.getLocation().getName() === 'left') {
        dictBorderId = node.getId();
        dictOpen = node.getSelected() !== -1;
      }
      if (node.getLocation().getName() === 'right') {
        imageBorderId = node.getId();
        imageOpen = node.getSelected() !== -1;
      }
    });
    return { model, dictBorderId, imageBorderId, dictOpen, imageOpen };
  });
  const [image, setImage] = useState<Pixel[]>([]);
  const [dictMap, setDict] = useState<Map<number, DictEntry>>(new Map());
  const dictionaryRef = useRef<DictionaryHandle>(null);
  const layoutRef = useRef<ILayoutApi>(null);
  const relay = useRelaySocket();
  const [dictOpen, setDictOpen] = useState(initialDictOpen);
  const [imageOpen, setImageOpen] = useState(initialImageOpen);

  function onModelChange(model: Model) {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(model.toJson()));
  }

  function toggleBorder(id: string, isOpen: boolean, setOpen: (open: boolean) => void) {
    model.doAction(Actions.updateNodeAttributes(id, { selected: isOpen ? -1 : 0 }));
    setOpen(!isOpen);
  }

  function onRenderTab(tabNode: TabNode, renderValues: ITabRenderValues) {
    if (tabNode.getComponent() === "chat") {
      const signal = (tabNode.getConfig() as ChatTabConfig)?.channel;
      const signals = signal ? [signal] : [-111, -65535];
      renderValues.content = <Text
        signals={signals}
        dictionary={dictMap}
        online={new Set(relay.online)}
        onSelectSignal={dictionaryRef.current?.focusSignal ?? (() => [])}
        />
    }
    
  }

  function factory(node: TabNode) {
    switch (node.getComponent()) {
      case 'dictionary':
        return <Dictionary onChangeDict={setDict} ref={dictionaryRef}/>;
      case 'image':
        return <Image image={image} dictionary={dictMap} />;
      case 'chat': {
        const channel = (node.getConfig() as ChatTabConfig)?.channel ?? null;
        return (
          <RelayPane
            dictionary={dictMap}
            onImage={img => {
              if (!imageOpen) {
                toggleBorder(imageBorderId, imageOpen, setImageOpen);
              }
              setImage(img);
            }}
            relay={relay}
            channel={channel}
            onSend={(msg, channel) => {
              if (msg[0] === -65534 && msg.length === 2) {
                const id = msg[1]?.toString() ?? "-111 -65535";
                try {
                  console.log(id);
                  model.doAction(Actions.addTab(
                    { id,
                      type: 'tab',
                      name: 'Message Chat',
                      component: 'chat',
                      config: { channel: msg[1] } satisfies ChatTabConfig },
                    node.getParent()!.getId(),
                    DockLocation.CENTER,
                    -1,
                  ))
                } catch (e) {
                  model.doAction(Actions.selectTab(id?.toString()));
                }
                return;
              }
              if (msg[0] === -65533 && msg.length === 2) {
                const id = msg[1]?.toString() ?? "-111 -65535";
                model.doAction(Actions.deleteTab(id));
                return;
              }
              if (channel) {
                relay.send([-65535, channel, ...msg])
              } else {
                relay.send(msg);
              }
            }}
            onDefine={signal => {
              if (!dictOpen) {
                toggleBorder(dictBorderId, dictOpen, setDictOpen);
              }
              dictionaryRef.current?.focusSignal(signal);
            }}/>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div className="app">
      <Toolbar
        relay={relay}
        dictOpen={dictOpen}
        onToggleDict={() => toggleBorder(dictBorderId, dictOpen, setDictOpen)}
        imageOpen={imageOpen}
        onToggleImage={() => toggleBorder(imageBorderId, imageOpen, setImageOpen)}
        />
      <div className="app-layout">
        <Layout ref={layoutRef}
        model={model}
        factory={factory}
        onRenderTab={onRenderTab}
        onModelChange={onModelChange}
        />
      </div>
    </div>
  );
}

export default App;
