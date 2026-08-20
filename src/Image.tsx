import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import "./Image.css";
import { compile } from './converter';
import { processImage } from './Message';
import type { DictEntry } from './Dictionary';

export interface Pixel {
  x: number,
  y: number,
  z: number,
  size: number,
  color: number,
}

const COLORS = [
  0xFF5800,
  0xBBFF00,
  0x00CDFF,
  0x0084FF,
  0x4D00FF,
  0xFB39FF,
  0xFF0FD7,
  0x484848,
  0x636363,
  0xFFFFFF,
  0xFFFFFF,
]

function lerp(start: number, end: number, progress: number, mask: number) {
  const startMask = start & mask;
  const endMask = end & mask;
  const lerped = startMask * (1 - progress) + endMask * progress;
  return lerped & mask;
}

function lerpColor(start: number, end: number, progress: number) {
  const r = lerp(start, end, progress, 0xFF0000);
  const g = lerp(start, end, progress, 0x00FF00);
  const b = lerp(start, end, progress, 0x0000FF);
  return r + g + b;
}

function getColor(colorId: number) {
  if (colorId < 0 || colorId > 64) return 0;
  const group = ~~(colorId / 7);
  const progress = (colorId % 7) / 7;
  return lerpColor(COLORS[group], COLORS[group+1], progress);
}

export function ImageViewer(props: {
  image: Pixel[],
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const image = props.image;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
    fillLight.position.set(-6, -2, -4);
    scene.add(fillLight);

    const geometry = new THREE.SphereGeometry(0.7, 32, 32);
    const spheres = image.map(pixel => {
      const material = new THREE.MeshStandardMaterial({ color: getColor(pixel.color), roughness: 0.6 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(pixel.x, pixel.z, -pixel.y);
      sphere.scale.set(pixel.size/Math.sqrt(2), pixel.size/Math.sqrt(2), pixel.size/Math.sqrt(2));
      scene.add(sphere);
      return sphere;
    });

    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(frameId);
      controls.dispose();
      geometry.dispose();
      spheres.forEach((sphere) => (sphere.material as THREE.Material).dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [image]);

  return <div className="image-viewer">
    <div className="image-container" ref={containerRef} />
  </div>;
}

export function ImageEditor(props: {
  image: Pixel[];
  onChangeImage: (image: Pixel[]) => void;
}) {

  type EditImage = [string, string, string, string, string][];
  const [image, setImage] = useState<EditImage>([]);

  useEffect(() => {
    setImage(props.image.map(pixel => [
      pixel.x.toString(),
      pixel.y.toString(),
      pixel.z.toString(),
      pixel.size.toString(),
      pixel.color.toString(),
    ]))
  }, [props.image]);

  function changeImage(updater: (prev: EditImage) => EditImage) {
    const newImage = updater(image);
    console.log(newImage);
    setImage(newImage);
    props.onChangeImage(newImage.map(pixel => {
      try {
        let numbers = pixel.map(x => parseFloat(x));
        if (numbers[4] < 0 || numbers[4] > 64) return undefined;
        return {
          x: numbers[0],
          y: numbers[1],
          z: numbers[2],
          size: numbers[3],
          color: numbers[4],
        }
      } catch (e) {
        return undefined;
      }
    }).filter(pixel => pixel !== undefined));
  }

  function updateCell(row: number, col: number, value: string) {
    return (prev: EditImage): EditImage => {
      return [...prev.slice(0, row),
        [...prev[row].slice(0, col), value, ...prev[row].slice(col+1)],
      ...prev.slice(row+1)] as any;
    }
  }

  return <div className="image-editor">
    <div className="image-editor-header">X</div>
    <div className="image-editor-header">Y</div>
    <div className="image-editor-header">Z</div>
    <div className="image-editor-header">R</div>
    <div className="image-editor-header">C</div>
    <button className='image-editor-header image-editor-delete'
      onClick={() => changeImage(prev => [...prev, ["0", "0", "0", "0", "0"]])}
    >+</button>
    {image.map((pixel, row) => {

      return <>
        <input className="image-editor-cell" value={pixel[0]}
          onChange={e => changeImage(updateCell(row, 0, e.currentTarget.value))}/>
        <input className="image-editor-cell" value={pixel[1]}
          onChange={e => changeImage(updateCell(row, 1, e.currentTarget.value))}/>
        <input className="image-editor-cell" value={pixel[2]}
          onChange={e => changeImage(updateCell(row, 2, e.currentTarget.value))}/>
        <input className="image-editor-cell" value={pixel[3]}
          onChange={e => changeImage(updateCell(row, 3, e.currentTarget.value))}/>
        <input className="image-editor-cell" value={pixel[4]}
          style={{backgroundColor: (() => {
            try {
              return `#${lerpColor(getColor(parseInt(pixel[4])),0,0.5).toString(16)}`
            } catch (e) {
              return "#000000"
            }
          })()}}
          onChange={e => changeImage(updateCell(row, 4, e.currentTarget.value))}/>
        <button className='image-editor-cell image-editor-delete'
          onClick={() => changeImage(prev => prev.filter((_,i) => i !== row))}
        >x</button>
      </>
    })}
  </div>
}

function imageToSignals(image: Pixel[]): number[] {
  const signals = [];
  signals.push(-53);
  signals.push(-14);
  for (const pixel of image) {
    signals.push(-52);
    for (let number of [pixel.x, pixel.y, pixel.z, pixel.size, pixel.color]) {
      number *= 10;
      if (number < 0) {
        signals.push(-1);
        number *= -1;
      }
      signals.push(~~(number / 10))
      if (~~(number % 10) !== 0) {
        signals.push(-10);
        signals.push(~~(number % 10));
      };
      signals.push(-3);
    }
  }
  signals.pop();
  signals.push(-15);
  return signals;
}

export function Image(props: {
  image: Pixel[];
  dictionary: Map<number, DictEntry>;
}) {
  const [loadedImage, setLoadedImage] = useState<Pixel[]>([]);
  const [image, setImage] = useState<Pixel[]>([]);

  useEffect(() => {
    setLoadedImage(props.image);
    setImage(props.image);
  }, [props.image]);

  return <div className="image">
    <div className="image-editor-controls">
      <button onClick={() => navigator.clipboard.readText()
        .then(text => {
          const compiled = compile(text, props.dictionary);
          const signals = compiled.split(" ").map(x => parseInt(x));
          setImage(processImage(signals)![0]);
        })
      }>→Import</button>
      <button onClick={() => navigator.clipboard.writeText(imageToSignals(image).join(" "))}>Export→</button>
    </div>
    <ImageViewer image={image}/>
    <ImageEditor image={loadedImage} onChangeImage={setImage}/>
  </div>
}
