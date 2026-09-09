import { describe, expect, it } from "vitest";
import { ALLOWED_AI_TABLES } from "./allowed-tables";
import {
  inferKnowledgeTopics,
  KNOWLEDGE_NODES,
  selectKnowledgeNodes,
} from "./knowledge-registry";

describe("knowledge registry", () => {
  it("has valid relations and relationships", () => {
    const ids = new Set(KNOWLEDGE_NODES.map((node) => node.id));
    expect(ids.size).toBe(KNOWLEDGE_NODES.length);
    for (const node of KNOWLEDGE_NODES) {
      expect(node.markdown).toMatch(/^## /);
      for (const relation of node.relations) {
        expect(ALLOWED_AI_TABLES).toContain(relation);
      }
      for (const related of node.related) expect(ids).toContain(related);
    }
  });

  it("selects related semantic nodes for a multi-facet question", () => {
    const question = "Compare the wet-weather strategy in this race";
    const topics = inferKnowledgeTopics(question);
    const ids = selectKnowledgeNodes(topics, question).map((node) => node.id);

    expect(topics).toEqual(
      expect.arrayContaining(["strategy", "weather", "comparison"]),
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "core-data-model",
        "race-shape-evidence",
        "weather-coverage",
        "normalized-comparisons",
      ]),
    );
  });

  it("retrieves a precise rules node without a vector dependency", () => {
    const question = "Could a driver earn a fastest-lap point in 2024?";
    const nodes = selectKnowledgeNodes(
      inferKnowledgeTopics(question),
      question,
    );
    expect(nodes.map((node) => node.id)).toContain("fastest-lap-bonus");
  });

  it("retrieves terminology by exact keyword even for a general question", () => {
    const question = "What does parc ferme mean in Formula 1?";
    const nodes = selectKnowledgeNodes(
      inferKnowledgeTopics(question),
      question,
    );

    expect(nodes.map((node) => node.id)).toContain("parc-ferme");
  });
});
