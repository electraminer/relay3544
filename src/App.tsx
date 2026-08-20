import { useState } from 'react';
import './App.css';
import { Relay } from './Relay';
import { Image, type Pixel } from './Image';
import { Dictionary, type DictEntry } from './Dictionary';

function App() {
  const [image, setImage] = useState<Pixel[]>([]);

  const [dictMap, setDict] = useState<Map<number, DictEntry>>(new Map());
  const [onDefine, setOnDefine] = useState<(signal: number) => void>(() => {});

  return (
    <div className="app">
      <Dictionary onChangeDict={setDict} setOnDefine={onDefine => setOnDefine(() => onDefine)}/>
      <Relay dictionary={dictMap} onImage={setImage} onDefine={onDefine}/>
      <Image image={image} dictionary={dictMap} />
    </div>
  );
}

export default App;
