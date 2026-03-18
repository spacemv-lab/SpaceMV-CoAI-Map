/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';

export interface CRSInfo {
  epsg: number;
  name: string;
  proj4: string;
  isValid: boolean;
}

/**
 * Coordinate Reference System validator
 */
@Injectable()
export class CrsValidator {
  private readonly logger = new Logger(CrsValidator.name);

  // Common CRS definitions
  private readonly commonCRS: Map<number, CRSInfo> = new Map([
    [4326, {
      epsg: 4326,
      name: 'WGS 84',
      proj4: '+proj=longlat +datum=WGS84 +no_defs',
      isValid: true,
    }],
    [3857, {
      epsg: 3857,
      name: 'Web Mercator',
      proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs',
      isValid: true,
    }],
    [4490, {
      epsg: 4490,
      name: 'CGCS2000',
      proj4: '+proj=longlat +ellps=GRS80 +no_defs',
      isValid: true,
    }],
    [32649, {
      epsg: 32649,
      name: 'WGS 84 / UTM zone 49N',
      proj4: '+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs',
      isValid: true,
    }],
    [32650, {
      epsg: 32650,
      name: 'WGS 84 / UTM zone 50N',
      proj4: '+proj=utm +zone=50 +datum=WGS84 +units=m +no_defs',
      isValid: true,
    }],
    [32651, {
      epsg: 32651,
      name: 'WGS 84 / UTM zone 51N',
      proj4: '+proj=utm +zone=51 +datum=WGS84 +units=m +no_defs',
      isValid: true,
    }],
  ]);

  /**
   * Validate and parse CRS string
   * Accepts formats: EPSG:4326, EPSG3857, 4326, etc.
   */
  parseCRS(crsString: string): CRSInfo | null {
    if (!crsString) {
      return this.commonCRS.get(4326)!; // Default to WGS84
    }

    // Extract EPSG code
    let epsgCode: number | null = null;

    // Try different formats
    const patterns = [
      /EPSG[:\s]?(\d+)/i,
      /EPSG(\d+)/i,
      /^(\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = crsString.match(pattern);
      if (match) {
        epsgCode = parseInt(match[1], 10);
        break;
      }
    }

    if (epsgCode === null || isNaN(epsgCode)) {
      this.logger.warn(`Invalid CRS format: ${crsString}`);
      return null;
    }

    return this.getCRS(epsgCode);
  }

  /**
   * Get CRS info by EPSG code
   */
  getCRS(epsgCode: number): CRSInfo | null {
    return this.commonCRS.get(epsgCode) || null;
  }

  /**
   * Validate if CRS is supported
   */
  isSupported(epsgCode: number): boolean {
    return this.commonCRS.has(epsgCode);
  }

  /**
   * Get default target CRS (WGS84)
   */
  getDefaultCRS(): CRSInfo {
    return this.commonCRS.get(4326)!;
  }

  /**
   * Validate coordinates are within bounds for the given CRS
   */
  validateCoordinates(lon: number, lat: number, epsgCode: number = 4326): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (epsgCode === 4326 || epsgCode === 4490) {
      // Geographic CRS - validate lat/lon bounds
      if (lon < -180 || lon > 180) {
        errors.push(`Longitude ${lon} is out of range [-180, 180]`);
      }
      if (lat < -90 || lat > 90) {
        errors.push(`Latitude ${lat} is out of range [-90, 90]`);
      }
    } else if (epsgCode === 3857) {
      // Web Mercator - validate projected bounds
      const maxExtent = 20037508.34;
      if (lon < -maxExtent || lon > maxExtent) {
        errors.push(`X coordinate ${lon} is out of Web Mercator bounds`);
      }
      if (lat < -maxExtent || lat > maxExtent) {
        errors.push(`Y coordinate ${lat} is out of Web Mercator bounds`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Suggest target CRS based on bbox
   */
  suggestCRS(bbox: [number, number, number, number]): number {
    const [minX, minY, maxX, maxY] = bbox;

    // If coordinates are already in meters (large values), likely projected
    if (Math.abs(minX) > 1000000 || Math.abs(maxX) > 1000000) {
      return 3857; // Web Mercator
    }

    // For China region, suggest CGCS2000 or appropriate UTM zone
    if (minX >= 73 && maxX <= 135 && minY >= 3 && maxY <= 54) {
      // China extent
      if (minX >= 73 && maxX <= 80) return 32643;
      if (minX >= 80 && maxX <= 86) return 32644;
      if (minX >= 86 && maxX <= 92) return 32645;
      if (minX >= 92 && maxX <= 98) return 32646;
      if (minX >= 98 && maxX <= 104) return 32647;
      if (minX >= 104 && maxX <= 110) return 32648;
      if (minX >= 110 && maxX <= 116) return 32649;
      if (minX >= 116 && maxX <= 122) return 32650;
      if (minX >= 122 && maxX <= 128) return 32651;
      if (minX >= 128 && maxX <= 134) return 32652;
      if (minX >= 134 && maxX <= 135) return 32653;
      return 4490; // CGCS2000 for general China
    }

    // Default to WGS84
    return 4326;
  }
}
