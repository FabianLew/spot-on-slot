import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvatarFallback, Avatar, Button, Input, Label, Skeleton } from "./index";

describe("Button", () => {
  it("renders the default variant with bg-primary", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("bg-primary");
  });

  it("renders the destructive variant with bg-danger", () => {
    render(<Button variant="destructive">Del</Button>);
    expect(screen.getByRole("button", { name: "Del" })).toHaveClass("bg-danger");
  });

  it("renders an anchor with asChild", () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Link" })).toHaveAttribute("href", "/x");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is not clickable when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Off
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Input and Label", () => {
  it("passes aria-invalid through", () => {
    render(<Input aria-invalid="true" aria-label="x" />);
    expect(screen.getByLabelText("x")).toHaveAttribute("aria-invalid", "true");
  });

  it("links Label htmlFor to Input", () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("shows the fallback initials without an image", () => {
    render(
      <Avatar>
        <AvatarFallback>JK</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("JK")).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech", () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("focus ring", () => {
  it("offsets the ring with the background color so dark mode has no white halo", () => {
    render(
      <>
        <Button>Go</Button>
        <Input aria-label="field" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Go" })).toHaveClass("focus-visible:ring-offset-background");
    expect(screen.getByRole("textbox", { name: "field" })).toHaveClass("focus-visible:ring-offset-background");
  });
});
