"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";

const Mapcontainer = () => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const rederBdMap = (map, bdData) => {
    map.addSource("bd", { type: "geojson", data: bdData });

    map.addLayer({
      id: "bd-outline",
      type: "line",
      source: "bd",
      paint: { "line-color": "#000", "line-width": 0.8 },
    });

    // zoom to fit Bangladesh
    const bounds = new maplibregl.LngLatBounds();
    bdData.features.forEach((f) => {
      f.geometry.coordinates.flat(2).forEach(([lng, lat]) => {
        bounds.extend([lng, lat]);
      });
    });

    const center = bounds.getCenter();

    map.setCenter(center);
    map.setMaxBounds([
      [bounds.getWest() - 4.95, bounds.getSouth() - 0.15],
      [bounds.getEast() + 4.95, bounds.getNorth() + 0.15],
    ]);

    map.fitBounds(bounds, { padding: 60 });
  };

  const renderDivisions = (map, divData, popup) => {
    divData.features = divData.features.map((f, i) => ({
      ...f,
      properties: {
        ...f.properties,
        fillColor: divisionColors[i % divisionColors.length],
      },
    }));

    map.addSource("divisions", {
      type: "geojson",
      data: divData,
      generateId: true,
    });

    map.addLayer({
      id: "divisions-fill",
      type: "fill",
      source: "divisions",
      paint: {
        "fill-color": ["get", "fillColor"],
        "fill-opacity": 0.6,
      },
    });

    map.addLayer({
      id: "divisions-outline",
      type: "line",
      source: "divisions",
      paint: { "line-color": "#000", "line-width": 0.1 },
    });

    const labelPoints = {
      type: "FeatureCollection",
      features: divData.features.map((feature) => ({
        type: "Feature",
        geometry: turf.centroid(feature).geometry,
        properties: feature.properties,
      })),
    };

    map.addSource("divisions-labels", { type: "geojson", data: labelPoints });

    map.addLayer({
      id: "divisions-label",
      type: "symbol",
      source: "divisions-labels",
      maxzoom: 7.5,
      layout: {
        "text-field": ["get", "ADM1_EN"],
        "text-size": 12,
        "text-anchor": "center",
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    // popup on hover
    let hoveredId = null;

    map.on("mousemove", "divisions-fill", (e) => {
      if (map.getZoom() >= 7.5) {
        popup.remove();
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const props = e.features[0].properties;

      const html = `
  <div class="px-3 py-2 min-w-40 rounded-lg">
    <h4 class="m-0 mb-1.5 text-[15px] font-semibold text-[#1a1a2e] pb-1.5"
        style="border-bottom: 2px solid ${props.fillColor}">
      ${props.ADM1_EN}
    </h4>
    <p class="my-1 text-xs text-gray-500">
      <b>Division Code:</b> ${props.ADM1_PCODE}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Country:</b> ${props.ADM0_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Area:</b> ${Number(props.Shape_Area).toFixed(2)} sq. units
    </p>
  </div>
`;

      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "divisions", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = e.features[0].id;
      map.setFeatureState(
        { source: "divisions", id: hoveredId },
        { hovered: true },
      );
    });

    // On mouse leave — remove popup
    map.on("mouseleave", "divisions-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "divisions", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = null;
    });

    // remove popup on zoom
    map.on("zoom", () => {
      if (map.getZoom() >= 7.5) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "divisions", id: hoveredId },
            { hovered: false },
          );
          hoveredId = null;
        }
      }
    });

    // highlight division on hover layer
    map.addLayer({
      id: "divisions-hover",
      type: "fill",
      source: "divisions",
      paint: {
        "fill-color": "#000",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hovered"], false],
          0.2,
          0,
        ],
      },
    });
  };

  const renderDistricts = (map, distData, popup) => {
    distData.features = distData.features.map((f, i) => ({
      ...f,
      properties: {
        ...f.properties,
        fillColor: divisionColors[i % divisionColors.length],
      },
    }));

    map.addSource("districts", {
      type: "geojson",
      data: distData,
      generateId: true,
    });

    map.addLayer({
      id: "districts-fill",
      type: "fill",
      source: "districts",
      minzoom: 7.5,
      paint: {
        // "fill-color": "transparent",
        "fill-color": ["get", "fillColor"],
        "fill-opacity": 0.4,
      },
    });

    map.addLayer({
      id: "districts-outline",
      type: "line",
      source: "districts",
      minzoom: 7.5,
      paint: { "line-color": "#000", "line-width": 0.1 },
    });

    const districtPoints = {
      type: "FeatureCollection",
      features: distData.features.map((f) => ({
        type: "Feature",
        geometry: turf.centroid(f).geometry,
        properties: f.properties,
      })),
    };

    map.addSource("districts-labels", {
      type: "geojson",
      data: districtPoints,
    });

    map.addLayer({
      id: "districts-label",
      type: "symbol",
      source: "districts-labels",
      minzoom: 7.5,
      maxzoom: 10,
      layout: {
        "text-field": ["get", "ADM2_EN"],
        "text-size": 11,
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    // popup on hover
    let hoveredId = null;

    map.on("mousemove", "districts-fill", (e) => {
      if (map.getZoom() < 7.5 || map.getZoom() >= 10) {
        popup.remove();
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const props = e.features[0].properties;

      const html = `
  <div class="px-3 py-2 min-w-40 rounded-lg">
    <h4 class="m-0 mb-1.5 text-[15px] font-semibold text-[#1a1a2e] pb-1.5"
        style="border-bottom: 2px solid ${props.fillColor}">
      ${props.ADM2_EN}
    </h4>
    <p class="my-1 text-xs text-gray-500">
      <b>District Code:</b> ${props.ADM2_PCODE}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Division:</b> ${props.ADM1_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Country:</b> ${props.ADM0_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Area:</b> ${Number(props.Shape_Area).toFixed(2)} sq. units
    </p>
  </div>
`;

      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "districts", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = e.features[0].id;
      map.setFeatureState(
        { source: "districts", id: hoveredId },
        { hovered: true },
      );
    });

    // On mouse leave — remove popup
    map.on("mouseleave", "districts-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "districts", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = null;
    });

    // remove popup on zoom
    map.on("zoom", () => {
      if (map.getZoom() < 7.5 || map.getZoom() >= 10) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "districts", id: hoveredId },
            { hovered: false },
          );
          hoveredId = null;
        }
      }
    });

    // highlight district on hover layer
    map.addLayer({
      id: "districts-hover",
      type: "fill",
      source: "districts",
      paint: {
        "fill-color": "#000",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hovered"], false],
          0.2,
          0,
        ],
      },
    });
  };

  const renderUpozilas = (map, upozilaData, popup) => {
    upozilaData.features = upozilaData.features.map((f, i) => ({
      ...f,
      properties: {
        ...f.properties,
        fillColor: divisionColors[i % divisionColors.length],
      },
    }));

    map.addSource("upozilas", {
      type: "geojson",
      data: upozilaData,
      generateId: true,
    });

    map.addLayer({
      id: "upozilas-fill",
      type: "fill",
      source: "upozilas",
      minzoom: 10,
      paint: {
        "fill-color": "transparent",
        // "fill-color": ["get", "fillColor"],
        // "fill-opacity": 0.4,
      },
    });

    map.addLayer({
      id: "upozilas-outline",
      type: "line",
      source: "upozilas",
      minzoom: 10,
      paint: { "line-color": "#000", "line-width": 0.1 },
    });

    const upozilaPoints = {
      type: "FeatureCollection",
      features: upozilaData.features.map((f) => ({
        type: "Feature",
        geometry: turf.centroid(f).geometry,
        properties: f.properties,
      })),
    };

    map.addSource("upozilas-labels", {
      type: "geojson",
      data: upozilaPoints,
    });

    map.addLayer({
      id: "upozilas-label",
      type: "symbol",
      source: "upozilas-labels",
      minzoom: 10,
      maxzoom: 11,
      layout: {
        "text-field": ["get", "ADM3_EN"],
        "text-size": 11,
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    // popup on hover
    let hoveredId = null;

    map.on("mousemove", "upozilas-fill", (e) => {
      if (map.getZoom() < 10) {
        popup.remove();
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const props = e.features[0].properties;

      const html = `
  <div class="px-3 py-2 min-w-40 rounded-lg">
    <h4 class="m-0 mb-1.5 text-[15px] font-semibold text-[#1a1a2e] pb-1.5"
        style="border-bottom: 2px solid ${props.fillColor}">
      ${props.ADM3_EN}
    </h4>
    <p class="my-1 text-xs text-gray-500">
      <b>Upozila Code:</b> ${props.ADM3_PCODE}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>District:</b> ${props.ADM2_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Division:</b> ${props.ADM1_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Country:</b> ${props.ADM0_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Area:</b> ${Number(props.Shape_Area).toFixed(2)} sq. units
    </p>
  </div>
`;

      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "upozilas", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = e.features[0].id;
      map.setFeatureState(
        { source: "upozilas", id: hoveredId },
        { hovered: true },
      );
    });

    // On mouse leave — remove popup
    map.on("mouseleave", "upozilas-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "upozilas", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = null;
    });

    // remove popup on zoom
    map.on("zoom", () => {
      if (map.getZoom() < 10 || map.getZoom() >= 11) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "upozilas", id: hoveredId },
            { hovered: false },
          );
          hoveredId = null;
        }
      }
    });

    // highlight upozila on hover layer
    map.addLayer({
      id: "upozilas-hover",
      type: "fill",
      source: "upozilas",
      paint: {
        "fill-color": "#000",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hovered"], false],
          0.2,
          0,
        ],
      },
    });
  };

  const renderUnions = (map, unionData, popup) => {
    unionData.features = unionData.features.map((f, i) => ({
      ...f,
      properties: {
        ...f.properties,
        fillColor: divisionColors[i % divisionColors.length],
      },
    }));

    map.addSource("unions", {
      type: "geojson",
      data: unionData,
      generateId: true,
    });

    map.addLayer({
      id: "unions-fill",
      type: "fill",
      source: "unions",
      minzoom: 11,
      paint: {
        // "fill-color": "transparent",
        "fill-color": ["get", "fillColor"],
        "fill-opacity": 0.4,
      },
    });

    map.addLayer({
      id: "unions-outline",
      type: "line",
      source: "unions",
      minzoom: 11,
      paint: { "line-color": "#000", "line-width": 0.1 },
    });

    const unionPoints = {
      type: "FeatureCollection",
      features: unionData.features.map((f) => ({
        type: "Feature",
        geometry: turf.centroid(f).geometry,
        properties: f.properties,
      })),
    };

    map.addSource("unions-labels", {
      type: "geojson",
      data: unionPoints,
    });

    map.addLayer({
      id: "unions-label",
      type: "symbol",
      source: "unions-labels",
      minzoom: 11,
      layout: {
        "text-field": ["get", "ADM4_EN"],
        "text-size": 11,
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#000",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
    });

    // popup on hover
    let hoveredId = null;

    map.on("mousemove", "unions-fill", (e) => {
      if (map.getZoom() < 11) {
        popup.remove();
        return;
      }

      map.getCanvas().style.cursor = "pointer";

      const props = e.features[0].properties;

      const html = `
  <div class="px-3 py-2 min-w-40 rounded-lg">
    <h4 class="m-0 mb-1.5 text-[15px] font-semibold text-[#1a1a2e] pb-1.5"
        style="border-bottom: 2px solid ${props.fillColor}">
      ${props.ADM4_EN}
    </h4>
    <p class="my-1 text-xs text-gray-500">
      <b>Union Code:</b> ${props.ADM4_PCODE}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Upazila Code:</b> ${props.ADM3_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>District:</b> ${props.ADM2_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Division:</b> ${props.ADM1_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Country:</b> ${props.ADM0_EN}
    </p>
    <p class="my-1 text-xs text-gray-500">
      <b>Area:</b> ${Number(props.Shape_Area).toFixed(2)} sq. units
    </p>
  </div>
`;

      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "unions", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = e.features[0].id;
      map.setFeatureState(
        { source: "unions", id: hoveredId },
        { hovered: true },
      );
    });

    // On mouse leave — remove popup
    map.on("mouseleave", "unions-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();

      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "unions", id: hoveredId },
          { hovered: false },
        );
      }
      hoveredId = null;
    });

    // remove popup on zoom
    map.on("zoom", () => {
      if (map.getZoom() < 11) {
        popup.remove();
        map.getCanvas().style.cursor = "";
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "unions", id: hoveredId },
            { hovered: false },
          );
          hoveredId = null;
        }
      }
    });

    // highlight union on hover layer
    map.addLayer({
      id: "unions-hover",
      type: "fill",
      source: "unions",
      paint: {
        "fill-color": "#000",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hovered"], false],
          0.2,
          0,
        ],
      },
    });
  };

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      maxZoom: 12,
    });

    map.on("load", async () => {
      const [bdRes, divRes, distRes, upozilaRes, unionRes] = await Promise.all([
        fetch("/data/bd.json"),
        fetch("/data/divisions.json"),
        fetch("/data/districts.json"),
        fetch("/data/upozilas.json"),
        fetch("/data/unions.json"),
      ]);
      const bdData = await bdRes.json();
      const divData = await divRes.json();
      const distData = await distRes.json();
      const upozilaData = await upozilaRes.json();
      const unionData = await unionRes.json();

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      rederBdMap(map, bdData);
      renderDivisions(map, divData, popup);
      renderDistricts(map, distData, popup);
      renderUpozilas(map, upozilaData, popup);
      renderUnions(map, unionData, popup);

      setLoading(false);
    });

    mapRef.current = map;
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
          <div className="w-12 h-12 border-[5px] border-gray-300 border-t-gray-700 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

const divisionColors = [
  "#00A6B4",
  "#89B8E4",
  "#788CC5",
  "#72C26F",
  "#AC8FC7",
  "#F8AA93",
  "#662D91",
  "#FFCA63",
  "#4ECDC4",
  "#C7F464",
  "#FF6B6B",
  "#556270",
  "#C44D58",
  "#FFA07A",
  "#20B2AA",
  "#9370DB",
  "#3CB371",
  "#F08080",
];
export default Mapcontainer;
