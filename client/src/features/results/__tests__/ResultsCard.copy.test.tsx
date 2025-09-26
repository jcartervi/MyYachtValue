import { render, screen } from "@testing-library/react";
import ResultsCard from "../ResultsCard";

it("uses Replacement Cost wording in caption and tile", () => {
  render(<ResultsCard wholesale={900000} market={1250000} replacement={1750000} />);
  expect(
    screen.getByText(
      /Range from Wholesale to Replacement Cost\. Needle marks Market Value\./i
    )
  ).toBeInTheDocument();
  expect(screen.getByTestId("replacement-tile")).toHaveTextContent(/Replacement Cost/i);
});
