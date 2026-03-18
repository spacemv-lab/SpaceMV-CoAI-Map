/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


type Position = number[];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatPosition(position: Position): string {
  return position.map(formatNumber).join(' ');
}

function formatPositionList(positions: Position[]): string {
  return positions.map((position) => formatPosition(position)).join(', ');
}

function formatLinearringList(rings: Position[][]): string {
  return rings
    .map((ring) => `(${formatPositionList(ring)})`)
    .join(', ');
}

function formatPolygonList(polygons: Position[][][]): string {
  return polygons
    .map((polygon) => `(${formatLinearringList(polygon)})`)
    .join(', ');
}

export function geoJsonGeometryToWkt(geometry: {
  type: string;
  coordinates: unknown;
}): string {
  switch (geometry.type) {
    case 'Point':
      return `POINT (${formatPosition(geometry.coordinates as Position)})`;
    case 'LineString':
      return `LINESTRING (${formatPositionList(geometry.coordinates as Position[])})`;
    case 'Polygon':
      return `POLYGON (${formatLinearringList(geometry.coordinates as Position[][])})`;
    case 'MultiPoint':
      return `MULTIPOINT (${(geometry.coordinates as Position[])
        .map((position) => `(${formatPosition(position)})`)
        .join(', ')})`;
    case 'MultiLineString':
      return `MULTILINESTRING (${(geometry.coordinates as Position[][])
        .map((line) => `(${formatPositionList(line)})`)
        .join(', ')})`;
    case 'MultiPolygon':
      return `MULTIPOLYGON (${formatPolygonList(
        geometry.coordinates as Position[][][],
      )})`;
    default:
      throw new Error(`Unsupported geometry type for WKT conversion: ${geometry.type}`);
  }
}
