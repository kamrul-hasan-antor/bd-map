"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { colors } from "../utility/colors";

const makePopupHTML = (props, title, rows) => `
  <div class="px-3 py-2 min-w-40 rounded-lg">
    <h4 class="m-0 mb-1.5 text-[15px] font-semibold text-[#1a1a2e] pb-1.5"
        style="border-bottom: 2px solid ${props.fillColor}">
      ${title}
    </h4>
    ${rows.map(([label, val]) => `<p class="my-1 text-xs text-gray-500"><b>${label}:</b> ${val}</p>`).join("\n    ")}
  </div>
`;

const areaStr = (area) => `${Number(area).toFixed(2)} sq. units`;

const renderLayer = (map, data, config, popup) => {
  data.features = data.features.map((f, i) => ({
    ...f,
    properties: {
      ...f.properties,
      fillColor: colors[i % colors.length],
    },
  }));

  const src = config.source;

  map.addSource(src, { type: "geojson", data, generateId: true });

  map.addLayer({
    id: `${src}-fill`,
    type: "fill",
    source: src,
    ...(config.minzoom && { minzoom: config.minzoom }),
    paint: {
      "fill-color": config.fillColor ?? ["get", "fillColor"],
      "fill-opacity": config.fillOpacity ?? 0.4,
    },
  });

  map.addLayer({
    id: `${src}-outline`,
    type: "line",
    source: src,
    ...(config.minzoom && { minzoom: config.minzoom }),
    paint: { "line-color": "#000", "line-width": 0.1 },
  });

  const labelPoints = {
    type: "FeatureCollection",
    features: data.features.map((f) => ({
      type: "Feature",
      geometry: turf.centroid(f).geometry,
      properties: f.properties,
    })),
  };

  map.addSource(`${src}-labels`, { type: "geojson", data: labelPoints });

  map.addLayer({
    id: `${src}-label`,
    type: "symbol",
    source: `${src}-labels`,
    ...(config.minzoom && { minzoom: config.minzoom }),
    ...(config.labelMaxzoom && { maxzoom: config.labelMaxzoom }),
    layout: {
      "text-field": ["get", config.nameKey],
      "text-size": config.textSize ?? 11,
      "text-anchor": config.textAnchor ?? "top",
    },
    paint: {
      "text-color": "#000",
      "text-halo-color": "#fff",
      "text-halo-width": 1.5,
    },
  });

  let hoveredId = null;
  const pMin = config.popupMinzoom ?? 0;
  const pMax = config.popupMaxzoom ?? Infinity;
  const inRange = (z) => z >= pMin && z < pMax;

  map.on("mousemove", `${src}-fill`, (e) => {
    if (!inRange(map.getZoom())) {
      popup.remove();
      return;
    }
    map.getCanvas().style.cursor = "pointer";
    popup
      .setLngLat(e.lngLat)
      .setHTML(config.popupHTML(e.features[0].properties))
      .addTo(map);
    if (hoveredId !== null)
      map.setFeatureState({ source: src, id: hoveredId }, { hovered: false });
    hoveredId = e.features[0].id;
    map.setFeatureState({ source: src, id: hoveredId }, { hovered: true });
  });

  map.on("mouseleave", `${src}-fill`, () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
    if (hoveredId !== null)
      map.setFeatureState({ source: src, id: hoveredId }, { hovered: false });
    hoveredId = null;
  });

  map.on("zoom", () => {
    if (!inRange(map.getZoom())) {
      popup.remove();
      map.getCanvas().style.cursor = "";
      if (hoveredId !== null) {
        map.setFeatureState({ source: src, id: hoveredId }, { hovered: false });
        hoveredId = null;
      }
    }
  });

  map.addLayer({
    id: `${src}-hover`,
    type: "fill",
    source: src,
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

const Mapcontainer = () => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const renderBdMap = (map, bdData) => {
    map.addSource("bd", { type: "geojson", data: bdData });
    map.addLayer({
      id: "bd-outline",
      type: "line",
      source: "bd",
      paint: { "line-color": "#000", "line-width": 0.8 },
    });

    const bounds = new maplibregl.LngLatBounds();
    bdData.features.forEach((f) => {
      f.geometry.coordinates
        .flat(2)
        .forEach(([lng, lat]) => bounds.extend([lng, lat]));
    });
    const center = bounds.getCenter();
    map.setCenter(center);
    map.setMaxBounds([
      [bounds.getWest() - 4.95, bounds.getSouth() - 0.15],
      [bounds.getEast() + 4.95, bounds.getNorth() + 0.15],
    ]);
    map.fitBounds(bounds, { padding: 60 });
  };

  // useEffect(() => {
  //   if (mapRef.current) return;

  //   const map = new maplibregl.Map({
  //     container: mapContainer.current,
  //     style: { version: 8, sources: {}, layers: [] },
  //     maxZoom: 12,
  //   });

  //   map.on("load", async () => {
  //     const [bdRes, divRes, distRes, upozilaRes, unionRes] = await Promise.all([
  //       fetch("/data/bd.json"),
  //       fetch("/data/divisions.json"),
  //       fetch("/data/districts.json"),
  //       fetch("/data/upozilas.json"),
  //       fetch("/data/thanas.json"),
  //     ]);
  //     const [bdData, divData, distData, upozilaData, unionData] =
  //       await Promise.all([
  //         bdRes.json(),
  //         divRes.json(),
  //         distRes.json(),
  //         upozilaRes.json(),
  //         unionRes.json(),
  //       ]);

  //     const popup = new maplibregl.Popup({
  //       closeButton: false,
  //       closeOnClick: false,
  //     });

  //     renderBdMap(map, bdData);

  //     renderLayer(
  //       map,
  //       divData,
  //       {
  //         source: "divisions",
  //         nameKey: "ADM1_EN",
  //         textSize: 12,
  //         textAnchor: "center",
  //         labelMaxzoom: 7.5,
  //         fillOpacity: 0.6,
  //         popupMaxzoom: 7.5,
  //         popupHTML: (props) =>
  //           makePopupHTML(props, props.ADM1_EN, [
  //             ["Division Code", props.ADM1_PCODE],
  //             ["Country", props.ADM0_EN],
  //             ["Area", areaStr(props.Shape_Area)],
  //           ]),
  //       },
  //       popup,
  //     );

  //     renderLayer(
  //       map,
  //       distData,
  //       {
  //         source: "districts",
  //         nameKey: "ADM2_EN",
  //         minzoom: 7.5,
  //         labelMaxzoom: 10,
  //         popupMinzoom: 7.5,
  //         popupMaxzoom: 10,
  //         popupHTML: (props) =>
  //           makePopupHTML(props, props.ADM2_EN, [
  //             ["District Code", props.ADM2_PCODE],
  //             ["Division", props.ADM1_EN],
  //             ["Country", props.ADM0_EN],
  //             ["Area", areaStr(props.Shape_Area)],
  //           ]),
  //       },
  //       popup,
  //     );

  //     renderLayer(
  //       map,
  //       upozilaData,
  //       {
  //         source: "upozilas",
  //         nameKey: "ADM3_EN",
  //         minzoom: 10,
  //         labelMaxzoom: 11,
  //         fillColor: "transparent",
  //         popupMinzoom: 10,
  //         popupMaxzoom: 11,
  //         popupHTML: (props) =>
  //           makePopupHTML(props, props.ADM3_EN, [
  //             ["Upozila Code", props.ADM3_PCODE],
  //             ["District", props.ADM2_EN],
  //             ["Division", props.ADM1_EN],
  //             ["Country", props.ADM0_EN],
  //             ["Area", areaStr(props.Shape_Area)],
  //           ]),
  //       },
  //       popup,
  //     );

  //     renderLayer(
  //       map,
  //       unionData,
  //       {
  //         source: "unions",
  //         nameKey: "ADM4_EN",
  //         minzoom: 11,
  //         popupMinzoom: 11,
  //         popupHTML: (props) =>
  //           makePopupHTML(props, props.ADM4_EN, [
  //             ["Union Code", props.ADM4_PCODE],
  //             ["Upazila Code", props.ADM3_EN],
  //             ["District", props.ADM2_EN],
  //             ["Division", props.ADM1_EN],
  //             ["Country", props.ADM0_EN],
  //             ["Area", areaStr(props.Shape_Area)],
  //           ]),
  //       },
  //       popup,
  //     );

  //     setLoading(false);
  //   });

  //   mapRef.current = map;
  // }, []);

  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: {}, layers: [] },
      maxZoom: 14,
    });

    map.on("load", async () => {
      const [bdRes, divRes] = await Promise.all([
        fetch("/data/bd.json"),
        fetch("/data/divisions.json"),
      ]);
      const [bdData, divData] = await Promise.all([
        bdRes.json(),
        divRes.json(),
      ]);

      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      renderBdMap(map, bdData);

      renderLayer(
        map,
        divData,
        {
          source: "divisions",
          nameKey: "ADM1_EN",
          textSize: 12,
          textAnchor: "center",
          labelMaxzoom: 7.5,
          fillOpacity: 0.6,
          popupMaxzoom: 7.5,
          popupHTML: (props) =>
            makePopupHTML(props, props.ADM1_EN, [
              ["Division Code", props.ADM1_PCODE],
              ["Country", props.ADM0_EN],
              ["Area", areaStr(props.Shape_Area)],
            ]),
        },
        popup,
      );
      setLoading(false);

      let districtsLoaded = false;
      let upozilaLoaded = false;
      let unionLoaded = false;

      const loadDistricts = async () => {
        if (districtsLoaded) return;
        districtsLoaded = true;
        const data = await fetch("/data/districts.json").then((r) => r.json());
        renderLayer(
          map,
          data,
          {
            source: "districts",
            nameKey: "ADM2_EN",
            minzoom: 7.5,
            labelMaxzoom: 10,
            popupMinzoom: 7.5,
            popupMaxzoom: 10,
            popupHTML: (props) =>
              makePopupHTML(props, props.ADM2_EN, [
                ["District Code", props.ADM2_PCODE],
                ["Division", props.ADM1_EN],
                ["Country", props.ADM0_EN],
                ["Area", areaStr(props.Shape_Area)],
              ]),
          },
          popup,
        );
      };

      const loadUpozilas = async () => {
        if (upozilaLoaded) return;
        upozilaLoaded = true;
        const data = await fetch("/data/upozilas.json").then((r) => r.json());
        renderLayer(
          map,
          data,
          {
            source: "upozilas",
            nameKey: "ADM3_EN",
            minzoom: 10,
            labelMaxzoom: 11,
            fillColor: "transparent",
            popupMinzoom: 10,
            popupMaxzoom: 11,
            popupHTML: (props) =>
              makePopupHTML(props, props.ADM3_EN, [
                ["Upozila Code", props.ADM3_PCODE],
                ["District", props.ADM2_EN],
                ["Division", props.ADM1_EN],
                ["Country", props.ADM0_EN],
                ["Area", areaStr(props.Shape_Area)],
              ]),
          },
          popup,
        );
      };

      const loadUnions = async () => {
        if (unionLoaded) return;
        unionLoaded = true;
        const data = await fetch("/data/thanas.json").then((r) => r.json());
        renderLayer(
          map,
          data,
          {
            source: "unions",
            nameKey: "ADM4_EN",
            minzoom: 11,
            popupMinzoom: 11,
            popupHTML: (props) =>
              makePopupHTML(props, props.ADM4_EN, [
                ["Union Code", props.ADM4_PCODE],
                ["Upazila Code", props.ADM3_EN],
                ["District", props.ADM2_EN],
                ["Division", props.ADM1_EN],
                ["Country", props.ADM0_EN],
                ["Area", areaStr(props.Shape_Area)],
              ]),
          },
          popup,
        );
      };

      map.on("zoom", () => {
        const z = map.getZoom();
        if (z > 5.5) loadDistricts();
        if (z > 7.5) loadUpozilas();
        if (z > 9.5) loadUnions();
      });
    });
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

export default Mapcontainer;
