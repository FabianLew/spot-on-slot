import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Toaster,
  toast,
} from "./index";

describe("Dialog", () => {
  it("opens, labels the close button, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent closeLabel="Zamknij">
          <DialogTitle>Tytuł</DialogTitle>
          <DialogDescription>Opis</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Tytuł")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Tytuł")).toBeNull());
  });
});

describe("Sheet", () => {
  it("renders the bottom side as a dialog", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent side="bottom" closeLabel="Zamknij">
          <SheetTitle>Więcej</SheetTitle>
          <SheetDescription>Opis</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("bottom-0");
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
  });
});

describe("Checkbox", () => {
  it("toggles checked state on click", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Zgoda" />);
    const box = screen.getByRole("checkbox", { name: "Zgoda" });
    expect(box).toHaveAttribute("aria-checked", "false");
    await user.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    expect(box).toHaveAttribute("data-state", "checked");
  });
});

describe("DropdownMenu", () => {
  it("opens with Enter and reports radio selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Język</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="pl" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="pl">Polski</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    screen.getByRole("button", { name: "Język" }).focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitemradio", { name: "English" }));
    expect(onValueChange).toHaveBeenCalledWith("en");
  });
});

describe("Select", () => {
  it("renders the placeholder and passes aria-invalid", () => {
    render(
      <Select>
        <SelectTrigger aria-invalid="true" aria-label="Rola">
          <SelectValue placeholder="Wybierz" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Rola" });
    expect(trigger).toHaveTextContent("Wybierz");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Toaster", () => {
  it("shows a toast message", async () => {
    render(<Toaster />);
    toast("Zapisano");
    expect(await screen.findByText("Zapisano")).toBeInTheDocument();
  });
});

describe("Toaster error", () => {
  it("renders an error toast together with an icon", async () => {
    render(<Toaster />);
    toast.error("Błąd");
    const text = await screen.findByText("Błąd");
    const item = text.closest("li");
    expect(item?.querySelector("svg")).not.toBeNull();
  });
});
