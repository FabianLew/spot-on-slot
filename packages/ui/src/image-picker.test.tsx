import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImagePicker, type ImagePickerLabels } from "./index";

const labels: ImagePickerLabels = {
  choose: "Wybierz zdjęcie",
  drop: "albo upuść je tutaj",
  hint: "JPEG, PNG lub WebP, do 10 MB",
  uploading: "Wysyłanie…",
  previewAlt: "Podgląd zdjęcia",
};

const photo = new File(["x"], "a.png", { type: "image/png" });

describe("ImagePicker", () => {
  it("passes the chosen file on", async () => {
    const onSelect = vi.fn();
    render(<ImagePicker labels={labels} onSelect={onSelect} />);
    await userEvent.upload(screen.getByLabelText(labels.choose), photo);
    expect(onSelect).toHaveBeenCalledWith(photo);
  });

  it("accepts a dropped file", () => {
    const onSelect = vi.fn();
    render(<ImagePicker labels={labels} onSelect={onSelect} />);
    fireEvent.drop(screen.getByText(labels.drop), { dataTransfer: { files: [photo] } });
    expect(onSelect).toHaveBeenCalledWith(photo);
  });

  it("shows the preview, the uploading state and an error with an icon", () => {
    const { rerender, container } = render(
      <ImagePicker labels={labels} onSelect={vi.fn()} previewUrl="http://s3/m.webp" uploading />,
    );
    expect(screen.getByRole("img", { name: labels.previewAlt })).toHaveAttribute("src", "http://s3/m.webp");
    expect(screen.getByRole("status")).toHaveTextContent(labels.uploading);
    expect(screen.getByLabelText(labels.choose)).toBeDisabled();

    rerender(<ImagePicker labels={labels} onSelect={vi.fn()} error="Plik za duży" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Plik za duży");
    expect(container.querySelector("[role=alert] svg")).not.toBeNull();
  });
});
