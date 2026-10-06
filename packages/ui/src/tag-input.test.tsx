import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SkillSlider } from "./skill-slider";
import { TagInput } from "./tag-input";

function Tags({ initial = [] as string[], max }: { initial?: string[]; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TagInput
        labels={{ label: "Tagi", remove: (tag) => `Usuń ${tag}` }}
        value={value}
        onChange={setValue}
        max={max}
      />
      <output>{value.join("|")}</output>
    </>
  );
}

describe("TagInput", () => {
  it("adds tags on Enter and comma, skips duplicates and removes them", async () => {
    render(<Tags />);
    const field = screen.getByLabelText("Tagi");
    await userEvent.type(field, "vinyl{Enter}open air,VINYL{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("vinyl|open air");

    await userEvent.click(screen.getByRole("button", { name: "Usuń vinyl" }));
    expect(screen.getByRole("status")).toHaveTextContent("open air");

    await userEvent.type(field, "{Backspace}");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("is disabled once the limit is reached", () => {
    render(<Tags initial={["a", "b"]} max={2} />);
    expect(screen.getByLabelText("Tagi")).toBeDisabled();
  });
});

describe("SkillSlider", () => {
  function Slider() {
    const [value, setValue] = useState(0);
    return <SkillSlider label="Energia" value={value} onChange={setValue} unsetLabel="brak" />;
  }

  it("starts unset and reports the picked value", () => {
    render(<Slider />);
    const slider = screen.getByRole("slider", { name: "Energia" });
    expect(slider).toHaveAttribute("aria-valuetext", "brak");
    fireEvent.change(slider, { target: { value: "7" } });
    expect(slider).toHaveAttribute("aria-valuetext", "7/10");
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });
});
