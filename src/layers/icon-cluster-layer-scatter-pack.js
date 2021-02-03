// Copyright (c) 2020 Urban Computing Foundation

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {CompositeLayer} from '@deck.gl/core';
import {ScatterplotLayer} from '@deck.gl/layers';
import Supercluster from 'supercluster';
import { sortBy } from 'lodash';
import * as d3 from 'd3';

function getIconName(value, count) {
  const num = count === undefined ? 1 : count
  let val = Math.round(value/num)

  return isNaN(val) ? '' : `${val}`;
}

const colorScale = d3.scaleLinear()
  .domain([0, 100])
  .range(['SkyBlue','red'])

function getIconColor(value) {
  if (isNaN(value)) {
    return [0,0,0]
  } else {
    return colorScale(value).split('(')[1].split(')')[0].split(',').map(d => +d)
  }
}


const svgToDataURL = (svg) => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const pack = (data,dimension) => d3.pack()
    .size([dimension, dimension])
    .padding(3)
    (d3.hierarchy(data)
        .sum(d => d.value)
.sort((a, b) => b.value - a.value))

const generatePoints = (points, zoom) => {
    let dimension = Math.ceil(Math.sqrt(points.children.length))*12;
    let center = points.geometry.coordinates;
    let dist = (1/(2**(zoom/1.8)))*10;

    let yStep = (360/40075)*dist;
    let xStep = (360/40075)*dist;

    let packedPoints = pack({
        name:'test',
        children: points.children.map(d => ({ 
            value: d.properties.scale,
            name: d.properties.GEOID,
            occupancy: d.value,
            coords: d.geometry.coordinates
        }))
    },dimension).children

    return zoom > 20 ? 
        packedPoints.map((f, idx) => ({
            coords: f.data.coords,
            radius: f.data.value,
            color: getIconColor(f.data.occupancy)
        }))
        : packedPoints.map((f, idx) => ({
            coords: [
                center[0]+(xStep*f.x)-(xStep*dimension/2),
                center[1]-(yStep*f.y)+(yStep*dimension/2)
            ],
            radius: f.data.value,
            color: getIconColor(f.data.occupancy)
    }))
}

export default class IconClusterLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    const rebuildIndex = changeFlags.dataChanged || props.sizeScale !== oldProps.sizeScale;
    const z = Math.floor(this.context.viewport.zoom);
    if (rebuildIndex) {
      const index = new Supercluster(
        {
          maxZoom: 30, 
          radius: props.sizeScale/(z*0.5)
        }
      );
      

      index.load(
        props.data.map(d => {
            return {
              geometry: {coordinates: props.getPosition(d)},
              value: d.value,
              properties: d
            }
        })
      );
      this.setState({index});
    }

    const clusterData = this.state.index.getClusters([-180, -85, 180, 85], z)
      .filter(d => d.id)
      .map(d => ({
        geometry: d.geometry,
        children: this.state.index.getLeaves(d.id, 1000)
      }))
      .map(d => generatePoints(d, this.context.viewport.zoom))
      .flat()
    if (rebuildIndex || z !== this.state.z) {

      this.setState({
        data: clusterData,
        // data: this.state.index.getClusters([-180, -85, 180, 85], z),
        z
      });
    }
  }


  getPickingInfo({info, mode}) {
    const pickedObject = info.object && info.object.properties;
    if (pickedObject) {
      if (pickedObject.cluster && mode !== 'hover') {
        info.objects = this.state.index
          .getLeaves(pickedObject.cluster_id, 25)
          .map(f => f.properties);
      }
      info.object = pickedObject;
    }
    return info;
  }

    renderLayers() {
        const {data, z} = this.state;
        
        return new ScatterplotLayer(
            this.getSubLayerProps({
            id: 'test scatterplot',
            data,
            opacity: 0.8,
            stroked: true,
            filled: true,
            radiusScale: (24-(z-4))*10,
            radiusUnits:'meters',
            radiusMinPixels: 2,
            lineWidthMinPixels: 1,
            getPosition: d => d.coords,
            getRadius: d => Math.sqrt(d.radius),
            getFillColor: d => d.color,
            getLineColor: d => [15,15,15,200],
            })
        )
    }
}