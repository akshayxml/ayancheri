import { useEffect, useRef } from "react";
import * as f3 from 'family-chart';
import 'family-chart/styles/family-chart.css';
import { familyData } from "./data";
import "./App.css";

export default function FamilyTree() {
  const cont = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = cont.current;
    if (!container) return;

    const f3Chart = f3.createChart(container, familyData as any);

    f3Chart
      .setTransitionTime(1000)
      .setCardXSpacing(250)
      .setCardYSpacing(150)
      .setSingleParentEmptyCard(false)
      .setShowSiblingsOfMain(false)
      .setOrientationVertical();

    f3Chart.setCardHtml()
      .setCardDisplay([["first name", "last name", "avatar"], ["birthday"]])
      .resetCardDim()
      .setMiniTree(true)
      .setStyle('imageRect')
      .setOnHoverPathToMain()
      .setOnCardClick((_: any, d: any) => {
        f3Chart.updateMainId(d.data.id).updateTree({ tree_position: 'main_to_middle' });
      });

    f3Chart.updateTree({ initial: true, tree_position: 'main_to_middle' });

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return <div className="f3 family-tree-container" ref={cont} />;
}
