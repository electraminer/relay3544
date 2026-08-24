
import { useEffect, useState } from "react";
import type { Message } from "../Message";
import * as THREE from 'three';
import { Table } from "../Table";

interface Pixel {
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

export class Image {
  private pixels: Pixel[];

  private constructor(pixels: Pixel[]) {
    this.pixels = pixels;
  }

  public static empty(): Image {
    return new Image([]);
  }

  public display(scene: THREE.Scene): (() => void) {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const spheres = this.pixels.map(pixel => {
      const material = new THREE.MeshStandardMaterial({ color: getColor(pixel.color), roughness: 0.6 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(pixel.x, pixel.z, -pixel.y);
      sphere.scale.set(pixel.size, pixel.size, pixel.size);
      scene.add(sphere);
      return sphere;
    });

    return () => {
      geometry.dispose();
      spheres.forEach((sphere) => (sphere.material as THREE.Material).dispose());
    }
  }

  public toSignals(): number[] {
    const signals = [];
    signals.push(-53);
    signals.push(-14);
    for (const pixel of this.pixels) {
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
    if (signals.length > 2) signals.pop();
    signals.push(-15);
    return signals;
  }

  public static fromSignals(signals: number[]): [Image, number, number] | undefined {
    // Look for image
    for (let imageStart = 0; imageStart < signals.length; imageStart++) {
      if (signals[imageStart] !== -53) continue;
      if (signals[imageStart + 1] !== -14) continue;
      let i = imageStart + 2;
      const pixels: Pixel[] = [];
      let valid = true;
      while (signals[i] !== -15) {
        // Pixel
        if (signals[i++] !== -52) {
          valid = false;
          continue;
        };
        const pixel = [];
        for (let n = 0; n < 5; n++) {
          let sign = 1;
          let number = 0;
          let precision = 1;
          if (signals[i] === -1) {
            sign = -1;
            i++;
          }
          while (signals[i] >= 0) {
            const digit = signals[i];
            number *= Math.pow(10, digit.toString().length)
            number += digit;
            i++;
          }
          if (signals[i] === -10) {
            i++;
            while (signals[i] >= 0) {
              const digit = signals[i];
              precision /= Math.pow(10, digit.toString().length)
              number += precision * digit;
              i++;
            }
          }
          if (signals[i] === -3) {
            i++;
          }
          pixel.push(number * sign);
        }
        pixels.push({x: pixel[0], y: pixel[1], z: pixel[2], size: pixel[3], color: pixel[4]});
      }
      if (valid) return [new Image(pixels), imageStart, i];
    }
    return;
  }

  public static ImageEditor(props: {
    image: Image;
    onChangeImage: (image: Image) => void;
  }) {

    type EditImage = [string, string, string, string, string][];
    const [image, setImage] = useState<EditImage>([]);

    useEffect(() => {
      setImage(props.image.pixels.map(pixel => [
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
      props.onChangeImage(new Image(newImage.map(pixel => {
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
      }).filter(pixel => pixel !== undefined)));
    }

    function updateCell(row: number, col: number, value: string) {
      return (prev: EditImage): EditImage => {
        return [...prev.slice(0, row),
          [...prev[row].slice(0, col), value, ...prev[row].slice(col+1)],
        ...prev.slice(row+1)] as any;
      }
    }

    return <Table
      columns={["X", "Y", "Z", "R", "C"]}
      dataColumnWidths="repeat(5, 1fr)"
      rows={image}
      onChangeCell={(row, col, value) => changeImage(updateCell(row, col, value))}
      onDeleteRow={row => changeImage(prev => prev.filter((_, i) => i !== row))}
      onAddRow={() => changeImage(prev => [...prev, ["0", "0", "0", "0", "0"]])}
      cellStyle={(_row, col, value) => {
        if (col !== 4) return undefined;
        try {
          return {backgroundColor: `#${lerpColor(getColor(parseInt(value)),0,0.5).toString(16)}`};
        } catch (e) {
          return {backgroundColor: "#000000"};
        }
      }}
      />
  }
}

export function processImages(messages: Message[]): Message[] {
  return messages
    .map(m => {
      const imageResult = Image.fromSignals(m.signals);
      if (!imageResult) return m;
      const [image, start, end] = imageResult;
      const cutImage = [...m.signals.slice(0, start + 2), -25, ...m.signals.slice(end)];

      return {...m, signals: cutImage, tags: [...m.tags, "image"], image}
    });
}