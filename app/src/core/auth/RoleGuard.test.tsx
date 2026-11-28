import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { fetch } from "expo/fetch";
import { Protected } from "./RoleGuard";
import { useAuthStore } from "./useAuthStore";
import { sessionTokens } from "../storage/sessionTokens";
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: "redirect" }, href),
  };
});
beforeEach(async () => {
  await sessionTokens.clear();
  useAuthStore.setState({ userId: null, role: null, ready: false });
  jest.mocked(fetch).mockClear();
});
test("protected routes wait for session restore before mounting private children", async () => {
  const view = await render(
    <Protected>
      <Text>private</Text>
    </Protected>,
  );
  expect(view.queryByText("private")).toBeNull();
  expect(view.queryByTestId("redirect")).toBeNull();
});
test("a role mismatch redirects before mounting elderly flows", async () => {
  useAuthStore.setState({ userId: 2, role: "CAREGIVER", ready: true });
  const view = await render(
    <Protected role="ELDERLY">
      <Text>private</Text>
    </Protected>,
  );
  expect(view.queryByText("private")).toBeNull();
  expect(view.getByTestId("redirect")).toBeTruthy();
});
test("offline startup restores the SecureStore identity without a network dependency", async () => {
  await sessionTokens.save({
    accessToken: "synthetic",
    refreshToken: "synthetic-refresh",
    userId: 1,
    role: "ELDERLY",
  });
  await useAuthStore.getState().restore();
  const view = await render(
    <Protected role="ELDERLY">
      <Text>private</Text>
    </Protected>,
  );
  expect(view.getByText("private")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
