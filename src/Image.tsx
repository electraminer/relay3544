import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPixelatedPass } from "three/examples/jsm/postprocessing/RenderPixelatedPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import "./Image.css";
import { compile } from "./converter";
import type { DictEntry } from "./Dictionary";
import { RenderPass } from "three/examples/jsm/Addons.js";
import { Image } from "./spoilers/Image";

export function ImageViewer(props: { image: Image }) {
  const [pixelated, setPixelated] = useState(
    localStorage.getItem("relay-image-pixelation") === "true",
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const image = props.image;

  useEffect(() => {
    localStorage.setItem("relay-image-pixelation", String(pixelated));
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

    const composer = new EffectComposer(renderer);
    if (pixelated) {
      composer.addPass(new RenderPixelatedPass(2, scene, camera));
      composer.addPass(new OutputPass());
    } else {
      composer.addPass(new RenderPass(scene, camera));
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
    fillLight.position.set(-6, -2, -4);
    scene.add(fillLight);

    const cleanup = image.display(scene);

    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      composer.render();
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(frameId);
      controls.dispose();
      composer.dispose();
      cleanup();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [image, pixelated]);

  return (
    <div className="image-viewer">
      <div className="image-container" ref={containerRef}>
        <button
          className={`pixelation-button pixelation-button--${pixelated}`}
          onClick={() => setPixelated(!pixelated)}
        >
          <span className="material-symbols-outlined">grain</span>
        </button>
      </div>
    </div>
  );
}

export function ImagePane(props: {
  image: Image;
  dictionary: Map<number, DictEntry>;
}) {
  const [loadedImage, setLoadedImage] = useState<Image>(Image.empty());
  const [image, setImage] = useState<Image>(Image.empty());

  useEffect(() => {
    setLoadedImage(props.image);
    setImage(props.image);
  }, [props.image]);

  return (
    <div className="image">
      <div className="image-editor-controls">
        <button
          onClick={() =>
            navigator.clipboard.readText().then((text) => {
              const compiled = compile(text, props.dictionary);
              const signals = compiled.split(" ").map((x) => parseInt(x));
              setImage(Image.fromSignals(signals)![0]);
            })
          }
        >
          →Import
        </button>
        <button
          onClick={() =>
            navigator.clipboard.writeText(image.toSignals().join(" "))
          }
        >
          Export→
        </button>
      </div>
      <ImageViewer image={image} />
      <Image.ImageEditor image={loadedImage} onChangeImage={setImage} />
    </div>
  );
}
