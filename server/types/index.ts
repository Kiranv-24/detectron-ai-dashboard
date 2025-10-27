// types/detection.ts
export interface Detection {
  class: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  bbox?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// types/violations.ts
export enum ViolationType {
  MissingHelmet = "Missing Helmet",
  MissingVest = "Missing Safety Vest",
  MissingBoots = "Missing Safety Boots",
  UnsafeArea = "Unsafe Area Access",
  ImproperPPE = "Improper PPE Usage"
}