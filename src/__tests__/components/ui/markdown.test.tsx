import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "@/components/ui/markdown";

describe("Markdown Component", () => {
  it("renders headings", () => {
    const { container } = render(<Markdown content="## Hello World" />);
    const h2 = container.querySelector("h2");
    expect(h2).toBeTruthy();
    expect(h2?.textContent).toBe("Hello World");
  });

  it("renders bold text", () => {
    const { container } = render(<Markdown content="This is **bold** text" />);
    const strong = container.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe("bold");
  });

  it("renders code blocks", () => {
    const { container } = render(<Markdown content={"```js\nconsole.log('hi')\n```"} />);
    const pre = container.querySelector("pre");
    expect(pre).toBeTruthy();
  });

  it("renders lists", () => {
    const { container } = render(<Markdown content={"- item 1\n- item 2"} />);
    const items = container.querySelectorAll("li");
    expect(items.length).toBe(2);
  });

  it("escapes HTML in code blocks", () => {
    const { container } = render(<Markdown content={"```\n<script>alert('xss')</script>\n```"} />);
    const code = container.querySelector("code");
    expect(code?.innerHTML).toContain("&lt;script&gt;");
  });
});
