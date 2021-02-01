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
import {IconLayer} from '@deck.gl/layers';
import Supercluster from 'supercluster';
import * as d3 from 'd3-scale';

function getIconName(value, count) {
  const num = count === undefined ? 1 : count
  let val = Math.round(value/num)

  return isNaN(val) ? '' : `${val}`;
}

const colorScale = d3.scaleLinear()
  .domain([0, 100])
  .range(['blue','red'])

function getIconColor(value, count) {
  const num = count === undefined ? 1 : count
  let val = Math.round(value/num)
  if (isNaN(val)) {
    return [0,0,0]
  } else {
    return colorScale(val).split('(')[1].split(')')[0].split(',').map(d => +d)
  }
}

export default class IconClusterLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    const rebuildIndex = changeFlags.dataChanged || props.sizeScale !== oldProps.sizeScale;
    if (rebuildIndex) {
      const index = new Supercluster(
        {
          maxZoom: 20, 
          radius: props.sizeScale,
          map: (props) => ({value: props.value}),
          reduce: (accumulated, props) => { accumulated.value += props.value; }
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


    const z = Math.floor(this.context.viewport.zoom);
    if (rebuildIndex || z !== this.state.z) {
      this.setState({
        data: this.state.index.getClusters([-180, -85, 180, 85], z),
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
    const {data} = this.state;
    const {iconAtlas, iconMapping, sizeScale} = this.props;

    return [new IconLayer(
        this.getSubLayerProps({
          id: 'icon bg',
          data,
          iconAtlas: `${iconAtlas.split('.png')[0]}_bg.png`,
          iconMapping,
          sizeScale,
          getPosition: d => d.geometry.coordinates,
          getIcon: d => getIconName(d.properties.value, d.properties.point_count),
          getColor: d => [255,255,255,200],
          getSize: d => d.properties.point_count === undefined ? 0 : Math.log(d.properties.point_count)/8,
          sizeMinPixels: 20
        })
      ),
      new IconLayer(
        this.getSubLayerProps({
          id: 'icon',
          data,
          iconAtlas,
          iconMapping,
          sizeScale,
          getPosition: d => d.geometry.coordinates,
          getIcon: d => getIconName(d.properties.value, d.properties.point_count),
          getColor: d => [...getIconColor(d.properties.value, d.properties.point_count),200],
          getSize: d => d.properties.point_count === undefined ? 0 : Math.log(d.properties.point_count)/8,
          sizeMinPixels: 20
        })
      )
    ]
  }
}