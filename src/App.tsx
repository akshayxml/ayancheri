import React from "react";
import * as f3 from 'family-chart';  // npm install family-chart@0.9.0 or yarn add family-chart@0.9.0
import 'family-chart/styles/family-chart.css';
import { familyData } from "./data";

export default class FamilyTree extends React.Component {
  cont = React.createRef<HTMLDivElement>();

  componentDidMount() {
    if (!this.cont.current) return;
    create(familyData)

    function create(data: any) {
      const f3Chart = f3.createChart('#FamilyChart', data);
      (window as any).f3Chart = f3Chart;
      f3Chart
        .setTransitionTime(1000)
        .setCardXSpacing(250)
        .setCardYSpacing(150)
        .setSingleParentEmptyCard(false)
        .setShowSiblingsOfMain(false)
        .setOrientationVertical()

      f3Chart.setCardHtml()
        .setCardDisplay([["first name", "last name", "avatar"], ["birthday"]])
        .resetCardDim()
        .setMiniTree(true)
        .setStyle('imageRect')
        .setOnHoverPathToMain()
        .setOnCardClick((_e: any, d: any) => {
          f3Chart.updateMainId(d.data.id).updateTree({ tree_position: 'main_to_middle' });
        })

      f3Chart.updateTree({ initial: true, tree_position: 'main_to_middle' })
    }
  }

  render() {
    return <div className="f3" id="FamilyChart" ref={this.cont} style={{ width: "100%", height: "900px", margin: "auto", backgroundColor: "rgb(33,33,33)", color: "#fff" }}></div>;
  }
}
