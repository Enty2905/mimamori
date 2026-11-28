/* eslint-disable import/no-named-as-default-member -- Testing the i18next instance API. */
import i18n from "./i18n";
test("Japanese and Vietnamese contain the same complete key set", () => {
  expect(
    Object.keys(i18n.getResourceBundle("ja", "translation")).sort(),
  ).toEqual(Object.keys(i18n.getResourceBundle("vi", "translation")).sort());
});
test("critical pending and error feedback is translated into Japanese", async () => {
  await i18n.changeLanguage("ja");
  expect(i18n.t("pendingSync")).toBe("端末に保存しました。同期待ちです");
  expect(i18n.t("sosFailed")).not.toContain("sosFailed");
  await i18n.changeLanguage("vi");
});
