const state = {
  data: null,
  activeView: "dashboard",
  month: "all",
  macro: "all",
  cashflowYear: "all",
  cashflowMonth: "all",
  cashflowSource: "all",
  dashboardYear: "all",
  dashboardMonths: [],
  account: "all",
  search: "",
  transactionType: "all",
  transactionStatus: "all",
  cardAccount: "all",
  cardSearch: "",
  cardType: "all",
  cardStatus: "all",
  transactionSort: "date_desc",
  cardSort: "date_desc",
  transactionModalKind: "regular",
  categorySearch: "",
  categoryType: "all",
  categoryLevel1: "all",
  categoryLevel2: "all",
  accountSearch: "",
  accountType: "all",
  accountStatus: "all",
  investmentDashboardYear: "all",
  investmentDashboardType: "all",
  investmentDashboardTicker: "all",
  investmentSearch: "",
  investmentType: "all",
  investmentOperation: "all",
  investmentAssetSearch: "",
  investmentAssetType: "all",
  incomeSearch: "",
  incomeType: "all",
  pendingImportKind: "regular",
};

const storageKeys = {
  categories: "fluxo-pessoal-extra-categories",
  transactions: "fluxo-pessoal-manual-transactions",
  deletedTransactions: "fluxo-pessoal-deleted-transactions",
  deletedCategories: "fluxo-pessoal-deleted-categories",
  codeMap: "fluxo-pessoal-category-code-map",
  accounts: "fluxo-pessoal-accounts",
  importHistory: "fluxo-pessoal-import-history",
  investments: "fluxo-pessoal-investments",
  incomes: "fluxo-pessoal-incomes",
  investmentAssets: "fluxo-pessoal-investment-assets",
};

const remotePersistence = {
  enabled: false,
  state: {},
  saveTimer: null,
  syncing: false,
};

const titles = {
  dashboard: ["Dashboard", "Visão consolidada dos lançamentos importados."],
  cashflow: ["Fluxo de caixa", "Resultado mensal por grupo e categoria."],
  transactions: ["Lançamentos", "Base única de movimentos financeiros."],
  cards: ["Cartão de crédito", "Movimentos de cartão separados da conta corrente."],
  investmentDashboard: ["Dashboard de investimentos", "Visão gerencial dos movimentos, posição estimada e proventos."],
  investments: ["Investimentos", "Base de compras e vendas por ticker."],
  income: ["Proventos", "Base de proventos e rendimentos recebidos."],
  investmentAssets: ["Cadastro de investimentos", "Tipos de investimento e tickers usados nos cadastros."],
  categories: ["Categorias", "Cadastro e hierarquia das categorias do fluxo de caixa."],
  accounts: ["Contas", "Cadastro das contas usadas nos lançamentos financeiros."],
  imports: ["Importação", "Caminho para automatizar a entrada de dados."],
};

const assetTypes = ["ação", "fundo", "fii", "renda fixa", "outro"];
const incomeTypes = ["dividendo", "jcp", "rendimento", "amortização", "outro"];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const currencyCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const integer = new Intl.NumberFormat("pt-BR");
const decimal2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantityFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const $ = (selector) => document.querySelector(selector);

function formatMoney(value, withCents = false) {
  return (withCents ? currencyCents : currency).format(value || 0);
}

function formatQuantity(value) {
  return quantityFormat.format(Number(value || 0));
}

function formatCompactMoney(value) {
  const amount = Number(value || 0);
  if (Math.abs(amount) < 1000) return formatMoney(amount);
  const compact = Math.abs(amount / 1000).toFixed(1).replace(".", ",");
  return `${amount < 0 ? "-" : ""}R$ ${compact} mil`;
}

function formatThousandsValue(value) {
  const amount = Number(value || 0) / 1000;
  const formatted = Math.abs(amount).toFixed(1).replace(".", ",");
  return amount < 0 ? `(${formatted})` : formatted;
}

function formatDateShort(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return text;
  }
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(text)) {
    return `${text.slice(0, 6)}20${text.slice(-2)}`;
  }
  return text;
}

function parseDateShort(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return "";
  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month}-${day}`;
}

function parseImportDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = parseDateShort(text);
  if (parsed) return parsed;
  if (/^\d+([,.]\d+)?$/.test(text)) {
    const serial = Number(text.replace(",", "."));
    if (serial > 20000 && serial < 90000) {
      const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
      return date.toISOString().slice(0, 10);
    }
  }
  return "";
}

function parseImportAmount(value) {
  const text = String(value || "").trim().replace(/\s/g, "");
  if (!text) return NaN;
  if (text.includes(",") && text.includes(".")) return Number(text.replace(/\./g, "").replace(",", "."));
  return Number(text.replace(",", "."));
}

function isPaymentMonth(month) {
  return /^\d{4}-\d{2}$/.test(String(month || ""));
}

function normalizeTransactionDates(tx) {
  const paymentDate = parseDateShort(tx.paymentDate);
  const dueDate = parseDateShort(tx.dueDate);
  const competenceDate = parseDateShort(tx.competenceDate) || dueDate || paymentDate || "";
  return {
    ...tx,
    competenceDate: competenceDate || null,
    dueDate: dueDate || paymentDate || null,
    paymentDate: paymentDate || null,
    month: paymentDate ? paymentDate.slice(0, 7) : "sem-data",
    status: paymentDate ? (tx.status || "baixado") : "previsto",
  };
}

function maskDateShortInput(input) {
  const digits = input.value.replace(/\D/g, "").slice(0, 8);
  input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

function moneyClass(value) {
  return value >= 0 ? "positive" : "negative";
}

function titleCase(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function monthLabel(month) {
  if (month === "all") return "Todos os meses";
  const [year, value] = month.split("-");
  return `${value}/${year}`;
}

function cashflowMonthLabel(month) {
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [year, value] = month.split("-");
  return `${monthNames[Number(value) - 1]}/${year}`;
}

function availableYears() {
  return [...new Set(state.data.transactions
    .map((tx) => tx.month)
    .filter((month) => isPaymentMonth(month) && month >= "2023-01")
    .map((month) => month.slice(0, 4)))]
    .sort();
}

function defaultDashboardYear() {
  const years = availableYears();
  const currentYear = String(new Date().getFullYear());
  return years.includes(currentYear) ? currentYear : years[years.length - 1] || "all";
}

function filteredTransactions() {
  return filteredTransactionsBy({
    account: state.account,
    search: state.search,
  });
}

function filteredTransactionsBy({ account = "all", search = "", accountKind = "all", type = state.macro, month = state.month, paymentStatus = "all" } = {}) {
  return state.data.transactions.filter((tx) => {
    if (month !== "all" && tx.month !== month) return false;
    if (account !== "all" && tx.account !== account) return false;
    if (type !== "all" && tx.macro !== type) return false;
    if (paymentStatus === "paid" && !tx.paymentDate) return false;
    if (paymentStatus === "pending" && tx.paymentDate) return false;
    if (accountKind === "card" && !isCreditCardTransaction(tx)) return false;
    if (accountKind === "regular" && isCreditCardTransaction(tx)) return false;
    if (!search) return true;
    const haystack = `${tx.description} ${tx.account} ${tx.category} ${tx.group} ${tx.code}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
}

function isCreditCardTransaction(tx) {
  return isCreditCardAccount(tx.account, tx.accountType);
}

function isCreditCardAccount(accountName, explicitType = "") {
  const account = state.data?.accounts?.find((item) => item.name === accountName);
  const type = normalizeAccountType(explicitType || account?.type || "");
  if (type === "cartão de crédito") return true;
  return normalizeAccountType(accountName) === "cartão de crédito";
}

function setOptions(select, options, selectedValue, allLabel) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = allLabel;
  select.appendChild(all);
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.appendChild(node);
  });
  select.value = options.some((option) => option.value === selectedValue) ? selectedValue : "all";
}

function setPlainOptions(select, options, selectedValue) {
  select.innerHTML = "";
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.appendChild(node);
  });
  if (selectedValue && options.some((option) => option.value === selectedValue)) {
    select.value = selectedValue;
  }
}

function setMultipleOptions(select, options, selectedValues) {
  select.innerHTML = "";
  const selected = new Set(selectedValues || []);
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    node.selected = selected.has(option.value);
    select.appendChild(node);
  });
}

function renderMonthChips(container, options, selectedValues) {
  const selected = new Set(selectedValues || []);
  container.innerHTML = options
    .map((option) => `
      <button class="month-chip ${selected.has(option.value) ? "active" : ""}" data-month="${option.value}" type="button">
        ${escapeHtml(option.label)}
      </button>
    `)
    .join("");
}

function monthChipOptions() {
  return [
    ["01", "Jan"],
    ["02", "Fev"],
    ["03", "Mar"],
    ["04", "Abr"],
    ["05", "Mai"],
    ["06", "Jun"],
    ["07", "Jul"],
    ["08", "Ago"],
    ["09", "Set"],
    ["10", "Out"],
    ["11", "Nov"],
    ["12", "Dez"],
  ].map(([value, label]) => ({ value, label }));
}

function initFilters() {
  const months = [...new Set(state.data.transactions.map((tx) => tx.month))]
    .filter((month) => isPaymentMonth(month) && month >= "2022-01")
    .sort()
    .map((month) => ({ value: month, label: monthLabel(month) }))
    .reverse();
  setOptions($("#monthFilter"), months, state.month, "Todos os meses");
  const cashflowYears = availableYears().map((year) => ({ value: year, label: year }));
  const cashflowMonths = monthChipOptions();
  setOptions($("#cashflowYearFilter"), cashflowYears, state.cashflowYear, "Todos os anos");
  setOptions($("#cashflowMonthFilter"), cashflowMonths, state.cashflowMonth, "Todos os meses");
  setOptions($("#cashflowSourceFilter"), [
    { value: "regular", label: "Lançamentos" },
    { value: "card", label: "Cartão de crédito" },
  ], state.cashflowSource, "Todas as origens");
  setOptions($("#dashboardYearFilter"), cashflowYears, state.dashboardYear, "Todos os anos");
  renderMonthChips($("#dashboardMonthFilter"), cashflowMonths, state.dashboardMonths);
  refreshInvestmentDashboardFilters();

  const regularAccounts = state.data.accounts
    .filter((account) => account.type !== "cartão de crédito")
    .filter((account) => account.active !== false || account.name === state.account)
    .map((account) => account.name)
    .sort()
    .map((account) => ({ value: account, label: account }));
  const cardAccounts = state.data.accounts
    .filter((account) => account.type === "cartão de crédito")
    .filter((account) => account.active !== false || account.name === state.cardAccount)
    .map((account) => account.name)
    .sort()
    .map((account) => ({ value: account, label: account }));
  if (state.account !== "all" && !regularAccounts.some((account) => account.value === state.account)) state.account = "all";
  if (state.cardAccount !== "all" && !cardAccounts.some((account) => account.value === state.cardAccount)) state.cardAccount = "all";
  setOptions($("#accountFilter"), regularAccounts, state.account, "Todas as contas");
  setOptions($("#cardAccountFilter"), cardAccounts, state.cardAccount, "Todos os cartões");

  const macros = ["receita", "despesa", "financiamento", "investimento", "transferencia"].map((macro) => ({
    value: macro,
    label: macro.charAt(0).toUpperCase() + macro.slice(1),
  }));
  setOptions($("#macroFilter"), macros, state.macro, "Todos os tipos");
  setOptions($("#transactionTypeFilter"), macros, state.transactionType, "Todos os tipos");
  setOptions($("#cardTypeFilter"), macros, state.cardType, "Todos os tipos");
  const paymentStatuses = [
    { value: "paid", label: "Baixados" },
    { value: "pending", label: "Não baixados" },
  ];
  setOptions($("#transactionStatusFilter"), paymentStatuses, state.transactionStatus, "Todas as baixas");
  setOptions($("#cardStatusFilter"), paymentStatuses, state.cardStatus, "Todas as baixas");
  const sortOptions = [
    { value: "date_desc", label: "Pagamento: mais recente" },
    { value: "date_asc", label: "Pagamento: mais antigo" },
    { value: "amount_desc", label: "Valor: maior para menor" },
    { value: "amount_asc", label: "Valor: menor para maior" },
    { value: "description_asc", label: "Descrição: A-Z" },
  ];
  setOptions($("#transactionSortFilter"), sortOptions, state.transactionSort, "Ordenação padrão");
  setOptions($("#cardSortFilter"), sortOptions, state.cardSort, "Ordenação padrão");

  refreshTransactionAccountControls(state.transactionModalKind, $("#editTxAccount")?.value || "");
  refreshTransactionCategorySelects(Number($("#editTxCategory")?.value || 0));
  refreshCategoryHierarchySelects();
  refreshCategoryFilters();
  refreshAccountFilters();
  refreshInvestmentFilters();
}

function refreshAccountFilters() {
  const types = ["corrente", "poupança", "investimento", "cartão de crédito", "dinheiro"].map((type) => ({
    value: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  }));
  setOptions($("#accountTypeFilter"), types, state.accountType, "Todos os tipos");
  setOptions($("#accountStatusFilter"), [
    { value: "active", label: "Ativas" },
    { value: "inactive", label: "Inativas" },
  ], state.accountStatus, "Todos os status");
}

function refreshInvestmentFilters() {
  const types = investmentTypeOptions();
  setOptions($("#investmentTypeFilter"), types.map((type) => ({ value: type, label: titleCase(type) })), state.investmentType, "Todos os tipos");
  setOptions($("#investmentOperationFilter"), [
    { value: "compra", label: "Compra" },
    { value: "venda", label: "Venda" },
  ], state.investmentOperation, "Todas as operações");
  setOptions($("#investmentAssetTypeFilter"), types.map((type) => ({ value: type, label: titleCase(type) })), state.investmentAssetType, "Todos os tipos");
  setOptions($("#incomeTypeFilter"), incomeTypes.map((type) => ({ value: type, label: titleCase(type) })), state.incomeType, "Todos os tipos");
  setOptions($("#editInvestmentAssetType"), types.map((type) => ({ value: type, label: titleCase(type) })), $("#editInvestmentAssetType")?.value || "ação");
  renderInvestmentReferenceLists();
}

function refreshInvestmentDashboardFilters() {
  const years = investmentDashboardYears().map((year) => ({ value: year, label: year }));
  const types = investmentTypeOptions().map((type) => ({ value: type, label: titleCase(type) }));
  const tickers = [...new Set([
    ...(state.data.investments || []).map((item) => item.ticker),
    ...(state.data.incomes || []).map((item) => item.ticker),
    ...(state.data.investmentAssets || []).map((item) => item.ticker),
  ].filter(Boolean).map((ticker) => String(ticker).toUpperCase()))]
    .sort()
    .map((ticker) => ({ value: ticker, label: ticker }));
  if (state.investmentDashboardYear !== "all" && !years.some((year) => year.value === state.investmentDashboardYear)) state.investmentDashboardYear = "all";
  if (state.investmentDashboardType !== "all" && !types.some((type) => type.value === state.investmentDashboardType)) state.investmentDashboardType = "all";
  if (state.investmentDashboardTicker !== "all" && !tickers.some((ticker) => ticker.value === state.investmentDashboardTicker)) state.investmentDashboardTicker = "all";
  setOptions($("#investmentDashboardYearFilter"), years, state.investmentDashboardYear, "Todos os anos");
  setOptions($("#investmentDashboardTypeFilter"), types, state.investmentDashboardType, "Todos os tipos");
  setOptions($("#investmentDashboardTickerFilter"), tickers, state.investmentDashboardTicker, "Todos os tickers");
}

function investmentDashboardYears() {
  return [...new Set([
    ...(state.data.investments || []).map((item) => String(item.date || "").slice(0, 4)),
    ...(state.data.incomes || []).map((item) => String(item.date || "").slice(0, 4)),
  ].filter((year) => /^\d{4}$/.test(year)))].sort().reverse();
}

function defaultInvestmentDashboardYear() {
  const years = investmentDashboardYears();
  const currentYear = String(new Date().getFullYear());
  return years.includes(currentYear) ? currentYear : years[0] || "all";
}

function investmentTypeOptions() {
  return [...new Set([...assetTypes, ...(state.data.investmentAssets || []).map((item) => item.type).filter(Boolean)])].sort();
}

function renderInvestmentReferenceLists() {
  const tickers = [...(state.data.investmentAssets || [])].sort((a, b) => a.ticker.localeCompare(b.ticker));
  $("#investmentTickerOptions").innerHTML = tickers
    .map((item) => `<option value="${escapeHtml(item.ticker)}">${escapeHtml(item.name || item.type || "")}</option>`)
    .join("");
  $("#investmentTypeOptions").innerHTML = investmentTypeOptions()
    .map((type) => `<option value="${escapeHtml(type)}"></option>`)
    .join("");
}

function refreshCategoryFilters() {
  const types = ["receita", "despesa", "financiamento", "investimento", "transferencia"].map((type) => ({
    value: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  }));
  setOptions($("#categoryTypeFilter"), types, state.categoryType, "Todos os tipos");

  const level1Options = uniqueOptions(state.data.categories.map((category) => category.level1).filter(Boolean));
  setOptions($("#categoryLevel1Filter"), level1Options, state.categoryLevel1, "Todos os níveis 1");

  const level2Options = uniqueOptions(state.data.categories
    .filter((category) => state.categoryLevel1 === "all" || category.level1 === state.categoryLevel1)
    .map((category) => category.level2)
    .filter(Boolean));
  setOptions($("#categoryLevel2Filter"), level2Options, state.categoryLevel2, "Todos os níveis 2");
}

function refreshCategorySelects() {
  refreshTransactionCategorySelects(Number($("#editTxCategory")?.value || 0));
}

function refreshTransactionAccountControls(kind = "regular", selectedAccount = "") {
  const allowedTypes = kind === "card"
    ? ["cartão de crédito"]
    : ["corrente", "poupança", "investimento", "dinheiro"];
  const currentType = allowedTypes.includes($("#editTxAccountType")?.value)
    ? $("#editTxAccountType").value
    : allowedTypes[0];
  const typeOptions = allowedTypes.map((type) => ({
    value: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  }));
  setPlainOptions($("#editTxAccountType"), typeOptions, currentType);
  $("#editTxAccountType").disabled = kind === "card";
  refreshTransactionAccountOptions(selectedAccount);
}

function refreshTransactionAccountOptions(selectedAccount = "") {
  const selectedType = $("#editTxAccountType").value;
  const accounts = state.data.accounts
    .filter((account) => account.type === selectedType)
    .filter((account) => account.active !== false || account.name === selectedAccount)
    .map((account) => account.name)
    .sort()
    .map((account) => ({ value: account, label: account }));
  setPlainOptions($("#editTxAccount"), accounts, selectedAccount || accounts[0]?.value || "");
}

function refreshTransactionCategorySelects(selectedCode = 0) {
  const selectedCategory = state.data.categories.find((category) => Number(category.code) === Number(selectedCode));
  const selected = {
    level1: $("#editTxLevel1")?.value || selectedCategory?.level1 || "",
    level2: $("#editTxLevel2")?.value || selectedCategory?.level2 || "",
    level3: $("#editTxLevel3")?.value || selectedCategory?.level3 || "",
    level4: $("#editTxLevel4")?.value || selectedCategory?.level4 || "",
  };

  const level1Options = uniqueOptions(state.data.categories.map((category) => category.level1).filter(Boolean));
  setCascadeOptions($("#editTxLevel1"), level1Options, selected.level1 || level1Options[0]?.value || "", "Selecione");
  selected.level1 = $("#editTxLevel1").value;

  const level2Options = uniqueOptions(state.data.categories
    .filter((category) => category.level1 === selected.level1)
    .map((category) => category.level2)
    .filter(Boolean));
  setCascadeOptions($("#editTxLevel2"), level2Options, selected.level2 || level2Options[0]?.value || "", "Todos");
  selected.level2 = $("#editTxLevel2").value;

  const level3Options = uniqueOptions(state.data.categories
    .filter((category) =>
      category.level1 === selected.level1 &&
      (!selected.level2 || category.level2 === selected.level2))
    .map((category) => category.level3)
    .filter(Boolean));
  setCascadeOptions($("#editTxLevel3"), level3Options, selected.level3 || level3Options[0]?.value || "", "Todos");
  selected.level3 = $("#editTxLevel3").value;

  const level4Options = uniqueOptions(state.data.categories
    .filter((category) =>
      category.level1 === selected.level1 &&
      (!selected.level2 || category.level2 === selected.level2) &&
      (!selected.level3 || category.level3 === selected.level3))
    .map((category) => category.level4)
    .filter(Boolean));
  setCascadeOptions($("#editTxLevel4"), level4Options, selected.level4 || level4Options[0]?.value || "", "Todos");
  selected.level4 = $("#editTxLevel4").value;

  const categoryOptions = state.data.categories
    .filter((category) =>
      category.level1 === selected.level1 &&
      (!selected.level2 || category.level2 === selected.level2) &&
      (!selected.level3 || category.level3 === selected.level3) &&
      (!selected.level4 || category.level4 === selected.level4))
    .sort((a, b) => a.code - b.code)
    .map((category) => ({
      value: String(category.code),
      label: `${category.code} - ${category.name}`,
    }));
  setPlainOptions($("#editTxCategory"), categoryOptions, selectedCode ? String(selectedCode) : categoryOptions[0]?.value || "");
}

function setCascadeOptions(select, options, selectedValue, placeholder) {
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.appendChild(empty);
  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.appendChild(node);
  });
  select.value = options.some((option) => option.value === selectedValue) ? selectedValue : "";
}

function refreshCategoryHierarchySelects() {
  const level1 = [...new Set(state.data.categories.map((category) => category.level1 || category.section))]
    .filter(Boolean)
    .sort()
    .map((item) => ({ value: item, label: item }));
  setPlainOptions($("#editCategoryLevel1"), level1, $("#editCategoryLevel1")?.value || level1[0]?.value || "");
  refreshEditCategoryLevelOptions();
}

function refreshEditCategoryLevelOptions() {
  refreshLevelOptions({
    level1: $("#editCategoryLevel1"),
    level2: $("#editCategoryLevel2"),
    level3: $("#editCategoryLevel3"),
    level4: $("#editCategoryLevel4"),
  });
  if (!Number($("#editCategoryOriginalCode").value || 0)) {
    $("#editCategoryCode").value = suggestCategoryCode();
  }
}

function refreshLevelOptions(selects) {
  const level1 = selects.level1.value;
  const level2 = selects.level2.value;
  const level3 = selects.level3.value;

  const level2Options = uniqueOptions(state.data.categories
    .filter((category) => (category.level1 || category.section) === level1)
    .map((category) => category.level2)
    .filter(Boolean));
  setPlainOptions(selects.level2, level2Options, level2 || level2Options[0]?.value || "");

  const currentLevel2 = selects.level2.value;
  const level3Options = uniqueOptions(state.data.categories
    .filter((category) => (category.level1 || category.section) === level1 && (category.level2 || "") === currentLevel2)
    .map((category) => category.level3)
    .filter(Boolean));
  setPlainOptions(selects.level3, level3Options, level3 || level3Options[0]?.value || "");

  const currentLevel3 = selects.level3.value;
  const level4Options = uniqueOptions(state.data.categories
    .filter((category) =>
      (category.level1 || category.section) === level1 &&
      (category.level2 || "") === currentLevel2 &&
      (category.level3 || "") === currentLevel3)
    .map((category) => category.level4 || category.group)
    .filter(Boolean));
  setPlainOptions(selects.level4, level4Options, selects.level4?.value || level4Options[0]?.value || "");
}

function uniqueOptions(values) {
  return [...new Set(values)].sort().map((value) => ({ value, label: value }));
}

function suggestCategoryCode() {
  const level1 = $("#editCategoryLevel1").value;
  const level2 = $("#editCategoryLevel2").value;
  const level3 = $("#editCategoryLevel3").value;
  const level4 = $("#editCategoryLevel4").value;
  const macro = $("#editCategoryMacro").value;
  const sameBranch = state.data.categories.filter((category) =>
    category.level1 === level1 &&
    (category.level2 || "") === (level2 || "") &&
    (category.level3 || "") === (level3 || "") &&
    (category.level4 || "") === (level4 || ""));
  const usedCodes = new Set(state.data.categories.map((category) => Number(category.code)));
  const branchMax = Math.max(0, ...sameBranch.map((category) => Number(category.code)).filter(Boolean));
  let nextCode = branchMax ? branchMax + 1 : macroBaseCode(macro);
  while (usedCodes.has(nextCode)) nextCode += 1;
  return nextCode;
}

function macroBaseCode(macro) {
  const ranges = {
    receita: 1000,
    despesa: 3000,
    financiamento: 5000,
    investimento: 7000,
    transferencia: 9000,
  };
  const base = ranges[macro] || 300;
  const used = state.data.categories
    .map((category) => Number(category.code))
    .filter((code) => code >= base && code < base + 2000);
  return Math.max(base - 1, ...used) + 1;
}

function readStorage(key) {
  if (remotePersistence.enabled && Object.prototype.hasOwnProperty.call(remotePersistence.state, key)) {
    return remotePersistence.state[key] || [];
  }
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (_error) {
    return [];
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  if (remotePersistence.enabled) {
    remotePersistence.state[key] = value;
    scheduleRemotePersist();
  }
}

async function loadRemotePersistence() {
  if (location.protocol === "file:") return;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    remotePersistence.enabled = true;
    remotePersistence.state = payload.data || {};
    if (!Object.keys(remotePersistence.state).length) {
      remotePersistence.state = Object.fromEntries(
        Object.values(storageKeys).map((key) => [key, readLocalStorageArray(key)]),
      );
      scheduleRemotePersist();
      return;
    }
    Object.entries(remotePersistence.state).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value || []));
    });
  } catch (error) {
    console.warn("Persistência remota indisponível; usando armazenamento local.", error);
  }
}

function readLocalStorageArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (_error) {
    return [];
  }
}

function scheduleRemotePersist() {
  if (!remotePersistence.enabled) return;
  window.clearTimeout(remotePersistence.saveTimer);
  remotePersistence.saveTimer = window.setTimeout(persistRemoteState, 450);
}

async function persistRemoteState() {
  if (!remotePersistence.enabled || remotePersistence.syncing) return;
  remotePersistence.syncing = true;
  try {
    await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: remotePersistence.state }),
    });
  } catch (error) {
    console.warn("Não foi possível salvar no Supabase agora.", error);
  } finally {
    remotePersistence.syncing = false;
  }
}

function hydrateLocalData() {
  const baseInvestments = state.data.investments || [];
  const savedInvestments = readStorage(storageKeys.investments);
  const investmentById = new Map(baseInvestments.map((item) => [item.id, item]));
  savedInvestments.forEach((item) => investmentById.set(item.id, item));
  state.data.investments = [...investmentById.values()];
  const baseIncomes = state.data.incomes || [];
  const savedIncomes = readStorage(storageKeys.incomes);
  const incomeById = new Map(baseIncomes.map((item) => [item.id, item]));
  savedIncomes.forEach((item) => incomeById.set(item.id, item));
  state.data.incomes = [...incomeById.values()];
  state.data.investmentAssets = buildInvestmentAssetBase();
  const savedInvestmentAssets = readStorage(storageKeys.investmentAssets);
  const assetByTicker = new Map(state.data.investmentAssets.map((item) => [item.ticker, item]));
  savedInvestmentAssets.forEach((item) => {
    const normalized = normalizeInvestmentAsset(item);
    if (normalized.ticker) assetByTicker.set(normalized.ticker, normalized);
  });
  state.data.investmentAssets = [...assetByTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  state.data.accounts = buildInitialAccounts();
  const savedAccounts = readStorage(storageKeys.accounts);
  if (savedAccounts.length) {
    const byName = new Map(state.data.accounts.map((account) => [account.name, account]));
    savedAccounts.forEach((account) => byName.set(account.name, normalizeAccount(account)));
    state.data.accounts = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  ensureDefaultOpeningBalances();
  const codeMap = readCodeMap();
  state.data.categories = state.data.categories.map((category) => {
    const normalized = normalizeCategory(category);
    const mappedCode = codeMap.get(Number(normalized.code));
    return mappedCode ? { ...normalized, code: mappedCode, previousCode: Number(normalized.code) } : normalized;
  });
  state.data.transactions = state.data.transactions.map((tx) => {
    const mappedCode = codeMap.get(Number(tx.code));
    const transaction = mappedCode ? { ...tx, code: mappedCode, previousCode: Number(tx.code) } : tx;
    return normalizeTransactionDates(transaction);
  });
  const deletedTransactions = new Set(readStorage(storageKeys.deletedTransactions));
  state.data.transactions = state.data.transactions.filter((tx) => !deletedTransactions.has(tx.id));
  const extraCategories = readStorage(storageKeys.categories);
  const manualTransactions = readStorage(storageKeys.transactions).map(normalizeTransactionDates);
  const deletedCategories = new Set(readStorage(storageKeys.deletedCategories).map(Number));
  state.data.categories = state.data.categories.filter((category) => !deletedCategories.has(Number(category.code)));
  const existingCodes = new Set(state.data.categories.map((category) => Number(category.code)));
  extraCategories.forEach((category) => {
    const normalized = normalizeCategory(category);
    state.data.categories = state.data.categories.filter((item) => Number(item.code) !== Number(normalized.code));
    state.data.categories.push(normalized);
    existingCodes.add(Number(normalized.code));
  });
  ensureSystemCategories();
  manualTransactions.forEach((tx) => {
    state.data.transactions = state.data.transactions.filter((item) => item.id !== tx.id);
    state.data.transactions.unshift(tx);
  });
  syncTransactionsWithCategories();
}

function ensureSystemCategories() {
  const systemCategories = [
    {
      code: 9996,
      name: "Caixa de Viagem",
      level1: "(=) Transitórias",
      level2: "",
      level3: "",
      level4: "Caixa de Viagem",
      group: "Caixa de Viagem",
      section: "(=) Transitórias",
      level: "",
      macro: "transferencia",
      system: true,
    },
    {
      code: 9997,
      name: "Adiantamentos",
      level1: "(=) Transitórias",
      level2: "",
      level3: "",
      level4: "Adiantamentos",
      group: "Adiantamentos",
      section: "(=) Transitórias",
      level: "",
      macro: "transferencia",
      system: true,
    },
    {
      code: 9998,
      name: "Pagamento Cartão",
      level1: "(=) Transitórias",
      level2: "",
      level3: "",
      level4: "Pagamento Cartão",
      group: "Pagamento Cartão",
      section: "(=) Transitórias",
      level: "",
      macro: "transferencia",
      system: true,
    },
    {
      code: 9999,
      name: "Transferencia entre Contas",
      level1: "(=) Transitórias",
      level2: "",
      level3: "",
      level4: "Transferencia entre Contas",
      group: "Transferencia entre Contas",
      section: "(=) Transitórias",
      level: "",
      macro: "transferencia",
      system: true,
    },
  ];
  systemCategories.forEach((category) => {
    state.data.categories = state.data.categories.filter((item) => Number(item.code) !== Number(category.code));
    state.data.categories.push(normalizeCategory(category));
  });
  state.data.categories.sort((a, b) => a.code - b.code);
}

function buildInitialAccounts() {
  const byName = new Map();
  state.data.transactions.forEach((tx) => {
    if (!tx.account) return;
    const current = byName.get(tx.account) || {
      name: tx.account,
      institution: tx.institution || tx.account.split(" - ")[0] || "",
      type: inferAccountKind(tx.accountType || tx.account),
      source: "importado",
    };
    byName.set(tx.account, current);
  });
  return [...byName.values()].map(normalizeAccount).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeAccount(account) {
  const inferredType = inferAccountKind(account.accountType || account.name || "");
  let type = account.type ? normalizeAccountType(account.type) : inferredType;
  if (type === "corrente" && inferredType === "cartão de crédito") type = inferredType;
  const defaultOpening = defaultOpeningBalanceForAccount(account.name || "");
  return {
    name: account.name || "",
    institution: account.institution || "",
    type,
    openingBalance: Number.isFinite(Number(account.openingBalance)) ? Number(account.openingBalance) : defaultOpening.amount,
    openingDate: account.openingDate || defaultOpening.date,
    active: account.active !== false,
    source: account.source || "manual",
  };
}

function normalizeInvestmentAsset(asset) {
  return {
    ticker: String(asset.ticker || "").trim().toUpperCase(),
    name: String(asset.name || asset.assetName || "").trim(),
    type: canonicalAssetType(asset.type || asset.assetType || "outro"),
    currency: String(asset.currency || "BRL").trim().toUpperCase(),
    broker: String(asset.broker || "").trim(),
    notes: String(asset.notes || "").trim(),
    source: asset.source || "manual",
  };
}

function canonicalAssetType(value) {
  const text = normalizedText(value);
  if (text === "acao" || text === "acoes" || text === "stock" || text === "stocks") return "ação";
  if (text === "fii" || text.includes("imobili")) return "fii";
  if (text.includes("renda fixa") || text.includes("tesouro") || text.includes("cdb")) return "renda fixa";
  if (text.includes("fundo")) return "fundo";
  return String(value || "outro").trim().toLowerCase() || "outro";
}

function buildInvestmentAssetBase() {
  const byTicker = new Map();
  const addAsset = (item) => {
    const ticker = String(item.ticker || "").trim().toUpperCase();
    if (!ticker) return;
    const current = byTicker.get(ticker) || {};
    byTicker.set(ticker, normalizeInvestmentAsset({
      ticker,
      name: current.name || item.assetName || ticker,
      type: current.type || item.assetType || "outro",
      currency: current.currency || inferInvestmentCurrency(ticker),
      broker: current.broker || item.broker || item.account || "",
      notes: current.notes || "",
      source: "importado",
    }));
  };
  (state.data.investments || []).forEach(addAsset);
  (state.data.incomes || []).forEach(addAsset);
  return [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function inferInvestmentCurrency(ticker) {
  if (["AAPL", "AMZN", "GS", "IVV", "NVDA", "NVO", "TSLA"].includes(String(ticker || "").toUpperCase())) return "USD";
  return "BRL";
}

function defaultOpeningBalanceForAccount(name) {
  return {
    amount: name === "BTG - Banco" ? -194.68 : 0,
    date: "2022-12-31",
  };
}

function openingBalanceForCashflow(firstMonth = "2023-01") {
  const firstMonthStart = `${firstMonth}-01`;
  return state.data.accounts
    .filter((account) => {
      if (state.account !== "all" && account.name !== state.account) return false;
      if (state.cashflowSource === "regular" && account.type === "cartão de crédito") return false;
      if (state.cashflowSource === "card" && account.type !== "cartão de crédito") return false;
      if (state.search) return false;
      return (account.openingDate || "2022-12-31") < firstMonthStart;
    })
    .reduce((sum, account) => sum + Number(account.openingBalance || 0), 0);
}

function inferAccountKind(value) {
  return normalizeAccountType(value);
}

function normalizeAccountType(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("cart") || text.includes("_c") || text.includes("credito") || text.includes("crédito")) return "cartão de crédito";
  if (text.includes("invest")) return "investimento";
  if (text.includes("caixa") || text.includes("dinheiro")) return "dinheiro";
  if (text.includes("poup")) return "poupança";
  if (["corrente", "poupança", "investimento", "cartão de crédito", "dinheiro"].includes(text)) return text;
  return "corrente";
}

function readCodeMap() {
  const raw = readStorage(storageKeys.codeMap);
  if (Array.isArray(raw)) {
    return new Map(raw.map((item) => [Number(item.from), Number(item.to)]));
  }
  return new Map(Object.entries(raw || {}).map(([from, to]) => [Number(from), Number(to)]));
}

function ensureDefaultOpeningBalances() {
  state.data.accounts = state.data.accounts.map((account) => normalizeAccount(account));
}

function writeCodeMap(map) {
  writeStorage(storageKeys.codeMap, [...map.entries()].map(([from, to]) => ({ from, to })));
}

function normalizeCategory(category) {
  const hasExplicitLevels = Boolean(category.level1 || category.level2 || category.level3 || category.level4);
  const level1 = category.level1 || category.section || "Sem nível 1";
  const level2 = category.level2 || (level1 === category.section ? "" : category.section || "");
  const level3 = category.level3 || "";
  const level4 = category.level4 || (hasExplicitLevels ? "" : category.group || "");
  return {
    ...category,
    code: Number(category.code),
    level1,
    level2,
    level3,
    level4,
    section: category.section || level2 || level1,
    group: level4 || level3 || level2 || category.group || level1,
    macro: category.macro || inferMacroFromCode(Number(category.code)),
  };
}

function syncTransactionsWithCategories() {
  const byCode = new Map(state.data.categories.map((category) => [Number(category.code), category]));
  state.data.transactions = state.data.transactions.map((tx) => {
    const category = byCode.get(Number(tx.code));
    if (!category) return tx;
    return {
      ...tx,
      category: category.name,
      level1: category.level1,
      level2: category.level2,
      level3: category.level3,
      level4: category.level4,
      section: category.section,
      group: category.group,
      macro: category.macro,
    };
  });
}

function inferMacroFromCode(code) {
  if ([9996, 9997, 9998, 9999].includes(code)) return "transferencia";
  if (code >= 100 && code < 300) return "receita";
  if (code >= 300 && code < 1200) return "despesa";
  if (code >= 1200 && code < 1500) return "financiamento";
  if (code >= 1500 && code < 2200) return "investimento";
  return "despesa";
}

function renderNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
  document.querySelectorAll(".nav-group").forEach((group) => {
    const isActive = Boolean(group.querySelector(`.nav-item[data-view="${state.activeView}"]`));
    group.classList.toggle("active", isActive);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active-view", view.id === state.activeView);
  });
  const [title, subtitle] = titles[state.activeView];
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = subtitle;
}

function renderDashboard() {
  const transactions = dashboardTransactions();
  const balanceCutoff = dashboardBalanceCutoffMonth(transactions);
  const balanceTransactions = dashboardBalanceTransactions(balanceCutoff);
  const revenue = transactions.filter(isRevenue).reduce((sum, tx) => sum + tx.amount, 0);
  const essentialFixedExpense = transactions.filter((tx) => normalizedText(tx.level3) === "despesas fixas (essencial)").reduce((sum, tx) => sum + tx.amount, 0);
  const nonEssentialFixedExpense = transactions.filter((tx) => normalizedText(tx.level3) === "despesas fixas (nao essencial)").reduce((sum, tx) => sum + tx.amount, 0);
  const temporaryExpense = transactions.filter((tx) => normalizedText(tx.level3) === "despesas temporarias").reduce((sum, tx) => sum + tx.amount, 0);
  const financialResult = transactions.filter((tx) => normalizedText(tx.level1) === "(=) resultado financiamento").reduce((sum, tx) => sum + tx.amount, 0);
  const investmentResult = transactions.filter((tx) => normalizedText(tx.level1) === "(=) resultado investimento").reduce((sum, tx) => sum + tx.amount, 0);
  const inflow = revenue;
  const outflow = essentialFixedExpense + nonEssentialFixedExpense + temporaryExpense + financialResult + investmentResult;
  const net = inflow + outflow;
  const accountBalance = accountBalances(transactions, balanceTransactions, balanceCutoff).reduce((sum, item) => sum + item.amount, 0);

  $("#kpiInflow").textContent = formatMoney(inflow);
  $("#kpiInflow").className = moneyClass(inflow);
  $("#kpiOutflow").textContent = formatMoney(outflow);
  $("#kpiOutflow").className = moneyClass(outflow);
  $("#kpiNet").textContent = formatMoney(net);
  $("#kpiNet").className = moneyClass(net);
  $("#kpiCount").textContent = integer.format(transactions.length);
  $("#revenueKpi").textContent = formatMoney(revenue);
  $("#essentialFixedExpenseKpi").textContent = formatMoney(essentialFixedExpense);
  $("#essentialFixedExpenseKpi").className = moneyClass(essentialFixedExpense);
  $("#nonEssentialFixedExpenseKpi").textContent = formatMoney(nonEssentialFixedExpense);
  $("#nonEssentialFixedExpenseKpi").className = moneyClass(nonEssentialFixedExpense);
  $("#temporaryExpenseKpi").textContent = formatMoney(temporaryExpense);
  $("#temporaryExpenseKpi").className = moneyClass(temporaryExpense);
  $("#essentialFixedExpensePct").textContent = percentOfRevenue(essentialFixedExpense, revenue);
  $("#nonEssentialFixedExpensePct").textContent = percentOfRevenue(nonEssentialFixedExpense, revenue);
  $("#temporaryExpensePct").textContent = percentOfRevenue(temporaryExpense, revenue);
  $("#financialResultPct").textContent = percentOfRevenue(financialResult, revenue);
  $("#financialResultKpi").textContent = formatMoney(financialResult);
  $("#financialResultKpi").className = moneyClass(financialResult);
  $("#investmentResultPct").textContent = percentOfRevenue(investmentResult, revenue);
  $("#investmentResultKpi").textContent = formatMoney(investmentResult);
  $("#investmentResultKpi").className = moneyClass(investmentResult);
  $("#accountBalanceKpi").textContent = formatMoney(accountBalance);
  $("#accountBalanceKpi").className = moneyClass(accountBalance);

  renderMonthlyChart();
  renderAccountBalances(transactions, balanceTransactions, balanceCutoff);
  renderCategoryVolume(transactions);
  renderExpenseMix(transactions);
  renderYearExpenseChart();
  renderTrendList();
}

function dashboardOpeningBalance(cutoffMonth) {
  return accountBalances([], dashboardBalanceTransactions(cutoffMonth), cutoffMonth).reduce((sum, item) => sum + item.amount, 0);
}

function dashboardTransactions() {
  return filteredTransactions().filter((tx) => {
    return isInDashboardPeriod(tx.month);
  });
}

function isInDashboardPeriod(month) {
  if (!isPaymentMonth(month)) return false;
  if (state.dashboardYear !== "all" && month.slice(0, 4) !== state.dashboardYear) return false;
  if (state.dashboardMonths.length && !state.dashboardMonths.includes(month.slice(5, 7))) return false;
  return true;
}

function dashboardBalanceCutoffMonth(periodTransactions = dashboardTransactions()) {
  if (state.month !== "all") return state.month;
  if (state.dashboardYear !== "all" && state.dashboardMonths.length) {
    return `${state.dashboardYear}-${state.dashboardMonths[state.dashboardMonths.length - 1]}`;
  }
  const months = periodTransactions
    .map((tx) => tx.month)
    .filter((month) => isPaymentMonth(month) && month >= "2023-01")
    .sort();
  if (months.length) return months[months.length - 1];
  if (state.dashboardYear !== "all") return `${state.dashboardYear}-12`;
  const allMonths = state.data.transactions
    .map((tx) => tx.month)
    .filter((month) => isPaymentMonth(month) && month >= "2023-01")
    .sort();
  return allMonths[allMonths.length - 1] || "2023-01";
}

function dashboardBalanceTransactions(cutoffMonth) {
  return filteredTransactionsBy({
    account: state.account,
    search: state.search,
    type: state.macro,
    month: "all",
  }).filter((tx) => {
    if (!isPaymentMonth(tx.month) || tx.month < "2023-01" || tx.month > cutoffMonth) return false;
    if (state.dashboardYear !== "all" && tx.month.slice(0, 4) > state.dashboardYear) return false;
    return true;
  });
}

function normalizedText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isRevenue(tx) {
  return normalizedText(tx.level2) === "(+) receitas";
}

function percentOfRevenue(value, revenue) {
  if (!revenue) return "0%";
  return `${Math.round(Math.abs((value / revenue) * 100))}%`;
}

function isFixedExpense(tx) {
  return tx.macro === "despesa" && String(tx.level3 || "").toLowerCase().includes("fixas");
}

function isVariableExpense(tx) {
  return tx.macro === "despesa" && !isFixedExpense(tx);
}

function renderMonthlyChart() {
  const chart = $("#monthlyChart");
  const periodTransactions = dashboardTransactions();
  const months = [...new Set(periodTransactions.map((tx) => tx.month).filter((month) => isPaymentMonth(month) && month >= "2023-01"))]
    .sort()
  const firstMonth = months[0] || dashboardBalanceCutoffMonth(periodTransactions);
  const lastMonth = months[months.length - 1] || firstMonth;
  const opening = dashboardOpeningBalance(previousMonth(firstMonth || "2023-01"));
  const revenue = periodTransactions.filter(isRevenue).reduce((sum, tx) => sum + tx.amount, 0);
  const essential = periodTransactions.filter((tx) => normalizedText(tx.level3) === "despesas fixas (essencial)").reduce((sum, tx) => sum + tx.amount, 0);
  const nonEssential = periodTransactions.filter((tx) => normalizedText(tx.level3) === "despesas fixas (nao essencial)").reduce((sum, tx) => sum + tx.amount, 0);
  const temporary = periodTransactions.filter((tx) => normalizedText(tx.level3) === "despesas temporarias").reduce((sum, tx) => sum + tx.amount, 0);
  const financing = periodTransactions.filter((tx) => normalizedText(tx.level1) === "(=) resultado financiamento").reduce((sum, tx) => sum + tx.amount, 0);
  const investment = periodTransactions.filter((tx) => normalizedText(tx.level1) === "(=) resultado investimento").reduce((sum, tx) => sum + tx.amount, 0);
  const periodResult = periodTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const mappedEffects = revenue + essential + nonEssential + temporary + financing + investment;
  const otherEffects = periodResult - mappedEffects;
  const finalBalance = opening + periodResult;
  renderWaterfallChart([
    { label: "Saldo inicial", value: opening, total: true },
    { label: "Receitas", value: revenue },
    { label: "Essenciais", value: essential },
    { label: "Não essenciais", value: nonEssential },
    { label: "Temporários", value: temporary },
    { label: "Financiamento", value: financing },
    { label: "Investimento", value: investment },
    { label: "Outras var.", value: otherEffects },
    { label: "Saldo final", value: finalBalance, total: true },
  ]);
  $("#rangeLabel").textContent = dashboardPeriodLabel(firstMonth, lastMonth);
}

function renderWaterfallChart(items) {
  const chart = $("#monthlyChart");
  let running = 0;
  const bars = items.map((item, index) => {
    const start = item.total ? 0 : running;
    const end = item.total ? item.value : running + item.value;
    if (item.total && index === 0) running = item.value;
    if (!item.total) running = end;
    return { ...item, index, start, end, low: Math.min(start, end), high: Math.max(start, end) };
  });
  const min = Math.min(...bars.map((bar) => bar.low), 0);
  const max = Math.max(...bars.map((bar) => bar.high), 1);
  const range = Math.max(max - min, 1);
  chart.className = "waterfall-chart";
  chart.innerHTML = bars.map((bar) => {
    const top = ((max - bar.high) / range) * 100;
    const height = Math.max(2, ((bar.high - bar.low) / range) * 100);
    const kind = bar.total ? "total" : bar.value >= 0 ? "positive" : "negative";
    const valueTop = Math.min(86, Math.max(4, top - 16));
    const connectorTop = ((max - bar.end) / range) * 100;
    const connector = bar.index < bars.length - 1
      ? `<div class="waterfall-connector" style="top:${connectorTop}%"></div>`
      : "";
    return `
      <div class="waterfall-item" title="${escapeHtml(bar.label)}: ${formatMoney(bar.value, true)}">
        <div class="waterfall-plot">
          ${connector}
          <em class="waterfall-value ${moneyClass(bar.value)}" style="top:${valueTop}%">${formatThousandsValue(bar.value)}</em>
          <div class="waterfall-bar ${kind}" style="top:${top}%;height:${height}%"></div>
        </div>
        <span>${escapeHtml(bar.label)}</span>
      </div>
    `;
  }).join("");
}

function dashboardPeriodLabel(firstMonth, lastMonth) {
  if (!firstMonth || !lastMonth) return "";
  if (state.dashboardMonths.length) {
    const labels = state.dashboardMonths.map((month) => cashflowMonthLabel(`${state.dashboardYear === "all" ? firstMonth.slice(0, 4) : state.dashboardYear}-${month}`));
    return labels.join(" + ");
  }
  return `${cashflowMonthLabel(firstMonth)} a ${cashflowMonthLabel(lastMonth)}`;
}

function accountBalances(periodTransactions, balanceTransactions = periodTransactions, cutoffMonth = dashboardBalanceCutoffMonth(periodTransactions)) {
  const totals = new Map();
  const cutoffDate = `${cutoffMonth}-31`;
  state.data.accounts.forEach((account) => {
    if (state.account !== "all" && account.name !== state.account) return;
    if (state.account === "all" && (account.active === false || normalizeAccountType(account.type) !== "corrente")) return;
    const openingBalance = !state.search && (account.openingDate || "2022-12-31") <= cutoffDate
      ? Number(account.openingBalance || 0)
      : 0;
    totals.set(account.name, {
      amount: openingBalance,
      count: 0,
    });
  });
  periodTransactions.forEach((tx) => {
    const row = totals.get(tx.account) || { amount: 0, count: 0 };
    row.count += 1;
    totals.set(tx.account, row);
  });
  balanceTransactions.forEach((tx) => {
    const row = totals.get(tx.account) || { amount: 0, count: 0 };
    row.amount += tx.amount;
    totals.set(tx.account, row);
  });
  return [...totals.values()];
}

function renderAccountBalances(periodTransactions, balanceTransactions = periodTransactions, cutoffMonth = dashboardBalanceCutoffMonth(periodTransactions)) {
  const totals = new Map();
  const cutoffDate = `${cutoffMonth}-31`;
  state.data.accounts.forEach((account) => {
    if (state.account !== "all" && account.name !== state.account) return;
    const openingBalance = !state.search && (account.openingDate || "2022-12-31") <= cutoffDate
      ? Number(account.openingBalance || 0)
      : 0;
    totals.set(account.name, {
      amount: openingBalance,
      count: 0,
    });
  });
  periodTransactions.forEach((tx) => {
    const row = totals.get(tx.account) || { amount: 0, count: 0 };
    row.count += 1;
    totals.set(tx.account, row);
  });
  balanceTransactions.forEach((tx) => {
    const row = totals.get(tx.account) || { amount: 0, count: 0 };
    row.amount += tx.amount;
    totals.set(tx.account, row);
  });
  const rows = [...totals.entries()]
    .sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount))
    .slice(0, 8);
  const max = Math.max(...rows.map(([, item]) => Math.abs(item.amount)), 1);
  $("#accountBalanceList").innerHTML = rows
    .map(([name, item]) => listRow(name, `${formatMoney(item.amount)} · ${integer.format(item.count)} lanç.`, Math.abs(item.amount) / max))
    .join("");
}

function renderCategoryVolume(transactions) {
  const currentMonth = dashboardCurrentExpenseMonth(transactions);
  const expenseRows = transactions.filter((tx) => tx.month === currentMonth && tx.amount < 0);
  const totals = new Map();
  expenseRows.forEach((tx) => {
    const row = totals.get(tx.category) || { amount: 0, count: 0 };
    row.amount += tx.amount;
    row.count += 1;
    totals.set(tx.category, row);
  });
  const rows = [...totals.entries()]
    .sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount))
    .slice(0, 8);
  const max = Math.max(...rows.map(([, item]) => Math.abs(item.amount)), 1);
  $("#categoryVolumeTitle").textContent = currentMonth
    ? `Categorias com maior volume - ${cashflowMonthLabel(currentMonth)}`
    : "Categorias com maior volume";
  $("#categoryVolumeList").innerHTML = rows
    .map(([name, item]) => listRow(name, `${formatMoney(item.amount)} · ${integer.format(item.count)} lanç.`, Math.abs(item.amount) / max))
    .join("") || `<p class="empty-state">Sem gastos no mês atual.</p>`;
}

function renderExpenseMix(transactions) {
  const currentMonth = dashboardCurrentExpenseMonth(transactions);
  const expenses = transactions.filter((tx) => tx.month === currentMonth && tx.amount < 0);
  const rows = [
    ["Fixos", Math.abs(expenses.filter(isFixedExpense).reduce((sum, tx) => sum + tx.amount, 0))],
    ["Variáveis", Math.abs(expenses.filter(isVariableExpense).reduce((sum, tx) => sum + tx.amount, 0))],
    ["Cartão de crédito", Math.abs(expenses.filter(isCreditCardTransaction).reduce((sum, tx) => sum + tx.amount, 0))],
  ];
  const max = Math.max(...rows.map(([, amount]) => amount), 1);
  $("#expenseMixTitle").textContent = currentMonth ? `Perfil de gastos - ${cashflowMonthLabel(currentMonth)}` : "Perfil de gastos";
  $("#expenseMixList").innerHTML = rows
    .map(([name, amount]) => listRow(name, formatMoney(amount), amount / max))
    .join("");
}

function dashboardCurrentExpenseMonth(transactions) {
  const current = new Date();
  const currentMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
  if (transactions.some((tx) => tx.month === currentMonth && tx.amount < 0)) return currentMonth;
  return [...new Set(transactions.map((tx) => tx.month).filter((month) => isPaymentMonth(month) && txMonthHasExpense(transactions, month)))]
    .sort()
    .pop() || "";
}

function txMonthHasExpense(transactions, month) {
  return transactions.some((tx) => tx.month === month && tx.amount < 0);
}

function dashboardTrendTransactions() {
  return filteredTransactionsBy({
    account: state.account,
    search: state.search,
    type: state.macro,
    month: "all",
  }).filter((tx) => isInDashboardPeriod(tx.month));
}

function monthSummary(transactions, month) {
  const rows = transactions.filter((tx) => tx.month === month);
  const inflow = rows.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const outflow = rows.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0);
  const fixed = Math.abs(rows.filter(isFixedExpense).reduce((sum, tx) => sum + tx.amount, 0));
  const variable = Math.abs(rows.filter(isVariableExpense).reduce((sum, tx) => sum + tx.amount, 0));
  return { inflow, outflow, net: inflow + outflow, fixed, variable, count: rows.length };
}

function previousMonth(month) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function renderMonthlyComparison() {
  const transactions = dashboardTrendTransactions();
  const months = [...new Set(transactions.map((tx) => tx.month).filter((month) => isPaymentMonth(month) && month >= "2023-01"))].sort();
  const currentMonth = state.month !== "all" ? state.month : months[months.length - 1];
  const priorMonth = currentMonth ? previousMonth(currentMonth) : "";
  const current = monthSummary(transactions, currentMonth || "");
  const prior = monthSummary(transactions, priorMonth);
  $("#comparisonRangeLabel").textContent = currentMonth ? `${cashflowMonthLabel(priorMonth)} x ${cashflowMonthLabel(currentMonth)}` : "";
  $("#monthlyComparison").innerHTML = [
    metricRow("Resultado", current.net, current.net - prior.net),
    metricRow("Entradas", current.inflow, current.inflow - prior.inflow),
    metricRow("Saídas", current.outflow, current.outflow - prior.outflow),
    metricRow("Lançamentos", current.count, current.count - prior.count, false),
  ].join("");
}

function metricRow(label, value, delta, money = true) {
  const formattedValue = money ? formatMoney(value) : integer.format(value || 0);
  const formattedDelta = money ? formatMoney(delta) : integer.format(delta || 0);
  return `
    <div class="metric-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${money ? moneyClass(value) : ""}">${formattedValue}</strong>
      <em class="${moneyClass(delta)}">${delta >= 0 ? "+" : ""}${formattedDelta}</em>
    </div>
  `;
}

function expenseYearGroup(tx) {
  const level3 = normalizedText(tx.level3);
  if (level3 === "despesas fixas (essencial)") return "essential";
  if (level3 === "despesas fixas (nao essencial)") return "nonEssential";
  if (level3 === "despesas temporarias") return "temporary";
  return "";
}

function renderYearExpenseChart() {
  const groups = [
    { key: "essential", label: "Essenciais" },
    { key: "nonEssential", label: "Não essenciais" },
    { key: "temporary", label: "Temporários" },
  ];
  const transactions = state.data.transactions.filter((tx) => isPaymentMonth(tx.month) && tx.month >= "2023-01" && expenseYearGroup(tx));
  const years = [...new Set(transactions.map((tx) => tx.month.slice(0, 4)))].sort();
  const totals = new Map(years.map((year) => [year, { essential: 0, nonEssential: 0, temporary: 0 }]));

  transactions.forEach((tx) => {
    const year = tx.month.slice(0, 4);
    const key = expenseYearGroup(tx);
    totals.get(year)[key] += tx.amount;
  });

  $("#yearExpenseRangeLabel").textContent = years.length ? `${years[0]} a ${years[years.length - 1]}` : "Sem dados";
  $("#yearExpenseChart").innerHTML = years.length
    ? `
      <div class="year-expense-legend">
        ${groups.map((group) => `<span><i class="${group.key}"></i>${escapeHtml(group.label)}</span>`).join("")}
      </div>
      <div class="year-expense-bars">
        ${years.map((year) => yearExpenseGroup(year, totals.get(year), groups)).join("")}
      </div>
    `
    : `<p class="empty-state">Sem gastos para comparar.</p>`;
}

function yearExpenseGroup(year, totals, groups) {
  const total = groups.reduce((sum, group) => sum + Math.abs(totals[group.key]), 0);
  return `
    <div class="year-expense-group">
      <div class="year-expense-stack" title="${escapeHtml(year)}: ${escapeHtml(formatMoney(total))}">
        ${groups
          .map((group) => {
            const amount = Math.abs(totals[group.key]);
            const share = total ? (amount / total) * 100 : 0;
            const label = `${Math.round(share)}%`;
            return `
              <div class="year-expense-segment ${group.key}" style="height:${share}%" title="${escapeHtml(group.label)} ${year}: ${escapeHtml(label)} · ${escapeHtml(formatMoney(amount))}">
                ${share >= 9 ? `<span>${escapeHtml(label)}</span>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>
      <strong>${escapeHtml(year)}</strong>
    </div>
  `;
}

function renderTrendList() {
  const transactions = dashboardTrendTransactions();
  const months = [...new Set(transactions.map((tx) => tx.month).filter((month) => isPaymentMonth(month) && month >= "2023-01"))]
    .sort()
    .slice(-6);
  const lastSix = new Set(months);
  const byCategory = new Map();
  transactions
    .filter((tx) => lastSix.has(tx.month) && tx.amount < 0)
    .forEach((tx) => {
      const row = byCategory.get(tx.category) || { amount: 0, count: 0 };
      row.amount += tx.amount;
      row.count += 1;
      byCategory.set(tx.category, row);
    });
  const summaries = [...byCategory.entries()]
    .sort((a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount))
    .slice(0, 6);
  const max = Math.max(...summaries.map(([, item]) => Math.abs(item.amount)), 1);
  $("#trendList").innerHTML = summaries
    .map(([category, item]) => listRow(category, `${formatMoney(item.amount)} · ${integer.format(item.count)} lanç.`, Math.abs(item.amount) / max))
    .join("") || `<p class="empty-state">Sem gastos nos últimos 6 meses.</p>`;
}

function listRow(name, value, ratio) {
  return `
    <div class="list-row">
      <div class="list-row-top">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(value)}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.max(3, ratio * 100)}%"></div></div>
    </div>
  `;
}

function renderCashflow() {
  const cashflowAccountKind = state.cashflowSource === "all" ? "all" : state.cashflowSource;
  const transactions = filteredTransactionsBy({
    account: state.account,
    search: state.search,
    type: state.macro,
    accountKind: cashflowAccountKind,
  });
  const balanceTransactions = filteredTransactionsBy({
    account: state.account,
    search: state.search,
    type: state.macro,
    accountKind: cashflowAccountKind,
    month: "all",
  });
  const months = [...new Set(state.data.transactions.map((tx) => tx.month).filter(isPaymentMonth))]
    .sort()
    .filter((month) => (state.month === "all" ? month >= "2023-01" : month === state.month))
    .filter((month) => month >= "2023-01")
    .filter((month) => state.cashflowYear === "all" || month.slice(0, 4) === state.cashflowYear)
    .filter((month) => state.cashflowMonth === "all" || month.slice(5, 7) === state.cashflowMonth);
  const emptyMonths = () => Object.fromEntries(months.map((month) => [month, 0]));
  const rowsByKey = new Map();
  const categoryByCode = new Map(state.data.categories.map((category) => [Number(category.code), category]));

  const bump = (key, seed, amount = 0, month = null) => {
    const row = rowsByKey.get(key) || { ...seed, months: emptyMonths(), total: 0 };
    if (month && months.includes(month)) row.months[month] += amount;
    row.total += amount;
    rowsByKey.set(key, row);
  };

  const hierarchyFor = (categoryLike) => ({
    level1: categoryLike.level1 || categoryLike.section || "Sem nível 1",
    level2: categoryLike.level2 || "",
    level3: categoryLike.level3 || "",
    level4: categoryLike.level4 || "",
  });

  const seedHierarchy = (category) => {
    const h = hierarchyFor(category);
    bump(`l1||${h.level1}`, { kind: "level1", label: h.level1, macro: category.macro });
    if (h.level2) bump(`l2||${h.level1}||${h.level2}`, { kind: "level2", label: h.level2, macro: category.macro });
    if (h.level3) bump(`l3||${h.level1}||${h.level2}||${h.level3}`, { kind: "level3", label: h.level3, macro: category.macro });
    if (h.level4) bump(`l4||${h.level1}||${h.level2}||${h.level3}||${h.level4}`, { kind: "level4", label: h.level4, macro: category.macro });
    bump(`cat||${category.code}`, { kind: "category", label: category.name, code: category.code, macro: category.macro });
  };

  const bumpHierarchy = (tx) => {
    const category = categoryByCode.get(Number(tx.code)) || tx;
    const h = hierarchyFor(category);
    const macro = category.macro || tx.macro;
    bump(`l1||${h.level1}`, { kind: "level1", label: h.level1, macro }, tx.amount, tx.month);
    if (h.level2) bump(`l2||${h.level1}||${h.level2}`, { kind: "level2", label: h.level2, macro }, tx.amount, tx.month);
    if (h.level3) bump(`l3||${h.level1}||${h.level2}||${h.level3}`, { kind: "level3", label: h.level3, macro }, tx.amount, tx.month);
    if (h.level4) bump(`l4||${h.level1}||${h.level2}||${h.level3}||${h.level4}`, { kind: "level4", label: h.level4, macro }, tx.amount, tx.month);
    bump(`cat||${tx.code}`, { kind: "category", label: category.name || tx.category, code: tx.code, macro }, tx.amount, tx.month);
  };

  if (state.account === "all" && !state.search) {
    state.data.categories
      .filter((category) => state.macro === "all" || category.macro === state.macro)
      .forEach(seedHierarchy);
  }
  transactions.filter((tx) => months.includes(tx.month)).forEach(bumpHierarchy);

  const level1Order = ["(=) Resultado Operacional", "(=) Resultado Financiamento", "(=) Resultado Investimento", "(=) Transitórias"];
  const level2Order = ["(+) Receitas", "(-) Despesas"];
  const level3Order = [
    "Receitas Fixas",
    "Receitas Variáveis",
    "Despesas Fixas (Essencial)",
    "Despesas Fixas (Não Essencial)",
    "Despesas Temporárias",
  ];
  const level4Order = [
    "Habitação",
    "Alimentação",
    "Saúde",
    "Transporte",
    "Despesas Pessoais",
    "Fitness/Esportes",
    "Educação",
    "Lazer",
    "Financeiras",
    "Outros",
    "Equipamentos",
    "Gastos com Imóvel",
    "Filhos/Presentes/Doações",
    "Outros Temporários",
    "Caixa de Viagem",
    "Adiantamentos",
    "Pagamento Cartão",
    "Transferencia entre Contas",
  ];
  const orderOf = (list, value) => {
    const index = list.indexOf(value);
    return index === -1 ? 999 : index;
  };
  const sortedCategories = [...state.data.categories]
    .filter((category) => state.macro === "all" || category.macro === state.macro)
    .sort((a, b) => {
      const ah = hierarchyFor(a);
      const bh = hierarchyFor(b);
      return orderOf(level1Order, ah.level1) - orderOf(level1Order, bh.level1) ||
        orderOf(level2Order, ah.level2) - orderOf(level2Order, bh.level2) ||
        orderOf(level3Order, ah.level3) - orderOf(level3Order, bh.level3) ||
        orderOf(level4Order, ah.level4) - orderOf(level4Order, bh.level4) ||
        ah.level3.localeCompare(bh.level3) ||
        ah.level4.localeCompare(bh.level4) ||
        a.code - b.code;
    });

  const rows = [];
  const pushed = new Set();
  const pushKey = (key) => {
    const row = rowsByKey.get(key);
    if (!row || pushed.has(key)) return;
    rows.push(row);
    pushed.add(key);
  };
  sortedCategories.forEach((category) => {
    const h = hierarchyFor(category);
    pushKey(`l1||${h.level1}`);
    if (h.level2) pushKey(`l2||${h.level1}||${h.level2}`);
    if (h.level3) pushKey(`l3||${h.level1}||${h.level2}||${h.level3}`);
    if (h.level4) pushKey(`l4||${h.level1}||${h.level2}||${h.level3}||${h.level4}`);
    pushKey(`cat||${category.code}`);
  });
  const visibleRows = rows.filter((row) => row.kind !== "category" || state.account === "all" || Math.abs(row.total) > 0);
  const periodMonths = emptyMonths();
  transactions.filter((tx) => months.includes(tx.month)).forEach((tx) => {
    periodMonths[tx.month] += tx.amount;
  });
  const monthSet = new Set(months);
  let runningBalance = openingBalanceForCashflow(months[0] || "2023-01") + balanceTransactions
    .filter((tx) => isPaymentMonth(tx.month) && tx.month >= "2023-01" && !monthSet.has(tx.month) && months.length && tx.month < months[0])
    .reduce((sum, tx) => sum + tx.amount, 0);
  const previousMonths = emptyMonths();
  const finalMonths = emptyMonths();
  months.forEach((month) => {
    previousMonths[month] = runningBalance;
    runningBalance += periodMonths[month] || 0;
    finalMonths[month] = runningBalance;
  });
  const periodTotal = months.reduce((sum, month) => sum + (periodMonths[month] || 0), 0);
  const summaryRows = [
    { kind: "summary", label: "(=) Resultado do Período", macro: "periodo", months: periodMonths, total: periodTotal },
    { kind: "summary", label: "(=) Saldo Anterior", macro: "saldo-anterior", months: previousMonths, total: months.length ? previousMonths[months[months.length - 1]] : 0 },
    { kind: "summary", label: "(=) Saldo Final", macro: "saldo-final", months: finalMonths, total: months.length ? finalMonths[months[months.length - 1]] : 0 },
  ];
  const tableRows = [...visibleRows, ...summaryRows];

  $("#cashflowTable").innerHTML = `
    <thead>
      <tr>
        <th class="cf-code">Cód.</th>
        <th class="cf-name">Natureza</th>
        ${months.map((month) => `<th class="money">${cashflowMonthLabel(month)}</th>`).join("")}
        <th class="money">Total</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows
        .map((row) => {
          const code = row.kind === "category" ? row.code : "";
          return `
            <tr class="cf-row cf-${row.kind} cf-${row.macro}">
              <td class="cf-code number">${code}</td>
              <td class="cf-name">${cashflowLabel(row)}</td>
              ${months.map((month) => amountCell(row.months[month] || 0)).join("")}
              ${amountCell(row.total)}
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
}

function cashflowLabel(row) {
  if (row.kind === "level1") return `<strong>${escapeHtml(row.label)}</strong>`;
  if (row.kind === "level2" || row.kind === "level3" || row.kind === "level4") {
    return `<span class="cf-expander">▾</span><strong>${escapeHtml(row.label)}</strong>`;
  }
  return `<span>${escapeHtml(row.label)}</span>`;
}

function renderTransactions() {
  const transactions = sortTransactions(filteredTransactionsBy({
    account: state.account,
    search: state.search,
    accountKind: "regular",
    type: state.transactionType,
    paymentStatus: state.transactionStatus,
  }), state.transactionSort);
  $("#transactionCountLabel").textContent = `${integer.format(transactions.length)} lançamentos encontrados`;
  renderTransactionSummary(transactions, "transaction");
  $("#transactionsTable").innerHTML = transactionTableHtml(transactions.slice(0, 600));
}

function renderCards() {
  const transactions = sortTransactions(filteredTransactionsBy({
    account: state.cardAccount,
    search: state.cardSearch,
    accountKind: "card",
    type: state.cardType,
    paymentStatus: state.cardStatus,
  }), state.cardSort);
  $("#cardCountLabel").textContent = `${integer.format(transactions.length)} lançamentos encontrados`;
  renderTransactionSummary(transactions, "card");
  $("#cardsTable").innerHTML = transactionTableHtml(transactions.slice(0, 600));
}

function renderTransactionSummary(transactions, prefix) {
  const inflow = transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const outflow = transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0);
  $(`#${prefix}Inflow`).textContent = formatMoney(inflow, true);
  $(`#${prefix}Outflow`).textContent = formatMoney(outflow, true);
  $(`#${prefix}Net`).textContent = formatMoney(inflow + outflow, true);
  $(`#${prefix}Inflow`).className = "positive";
  $(`#${prefix}Outflow`).className = "negative";
  $(`#${prefix}Net`).className = moneyClass(inflow + outflow);
}

function sortTransactions(transactions, sortKey = "date_desc") {
  const dateValue = (tx) => tx.paymentDate || tx.competenceDate || tx.dueDate || "";
  return [...transactions].sort((a, b) => {
    if (sortKey === "amount_desc") return Math.abs(b.amount || 0) - Math.abs(a.amount || 0);
    if (sortKey === "amount_asc") return Math.abs(a.amount || 0) - Math.abs(b.amount || 0);
    if (sortKey === "description_asc") return String(a.description || "").localeCompare(String(b.description || ""));
    if (sortKey === "date_asc") return dateValue(a).localeCompare(dateValue(b));
    return dateValue(b).localeCompare(dateValue(a));
  });
}

function transactionTableHtml(transactions) {
  return `
    <thead>
      <tr>
        <th title="Competência">Compet.</th>
        <th title="Pagamento">Pagto.</th>
        <th>Descrição</th>
        <th>Conta</th>
        <th>Tipo conta</th>
        <th>Origem</th>
        <th>Categoria</th>
        <th>Cód.</th>
        <th>Tipo</th>
        <th class="money">Valor</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${transactions.length ? transactions
        .map(
          (tx) => `
            <tr>
              <td class="tx-date">${escapeHtml(formatDateShort(tx.competenceDate))}</td>
              <td class="tx-date">${paymentDateCell(tx)}</td>
              <td class="tx-description">${escapeHtml(tx.description)}</td>
              <td class="tx-account">${escapeHtml(tx.account)}</td>
              <td class="tx-kind"><span class="pill neutral">${escapeHtml(transactionKindLabel(tx))}</span></td>
              <td class="tx-source"><span class="pill neutral">${escapeHtml(transactionSourceLabel(tx))}</span></td>
              <td class="tx-category">${escapeHtml(tx.category)}</td>
              <td class="number tx-code">${tx.code}</td>
              <td class="tx-type"><span class="pill ${tx.macro}">${escapeHtml(tx.macro)}</span></td>
              ${amountCell(tx.amount, true)}
              <td class="action-cell">
                <button class="table-action" data-action="edit-transaction" data-id="${escapeHtml(tx.id)}" type="button">Editar</button>
                <button class="table-action" data-action="duplicate-transaction" data-id="${escapeHtml(tx.id)}" type="button">Duplicar</button>
                <button class="table-action danger" data-action="delete-transaction" data-id="${escapeHtml(tx.id)}" type="button">Excluir</button>
              </td>
            </tr>
          `,
        )
        .join("") : `<tr><td colspan="11">Nenhum lançamento encontrado.</td></tr>`}
    </tbody>
  `;
}

function transactionKindLabel(tx) {
  if (isCreditCardTransaction(tx)) return "Cartão";
  return normalizeAccountType(tx.accountType || tx.account) === "investimento" ? "Investimento" : "Conta";
}

function transactionSourceLabel(tx) {
  const source = normalizedText(`${tx.sheet || ""} ${tx.status || ""}`);
  if (source.includes("manual")) return "Lançamento manual";
  return "Importação";
}

function paymentDateCell(tx) {
  if (tx.paymentDate) return escapeHtml(formatDateShort(tx.paymentDate));
  return `<span class="pill pending">Pendente</span>`;
}

function renderCategories() {
  const rows = [...state.data.categories]
    .filter((row) => {
      if (state.categoryType !== "all" && row.macro !== state.categoryType) return false;
      if (state.categoryLevel1 !== "all" && row.level1 !== state.categoryLevel1) return false;
      if (state.categoryLevel2 !== "all" && row.level2 !== state.categoryLevel2) return false;
      if (!state.categorySearch) return true;
      const haystack = `${row.code} ${row.name} ${row.level1} ${row.level2} ${row.level3} ${row.level4} ${row.macro}`.toLowerCase();
      return haystack.includes(state.categorySearch.toLowerCase());
    })
    .sort((a, b) => a.code - b.code);
  $("#categoryCountLabel").textContent = `${integer.format(rows.length)} categorias analíticas`;
  $("#categoriesTable").innerHTML = `
    <thead>
      <tr>
        <th>Categoria</th>
        <th>Código</th>
        <th>Nível 1</th>
        <th>Nível 2</th>
        <th>Nível 3</th>
        <th>Nível 4</th>
        <th>Tipo</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `
            <tr class="category-row">
              <td>${escapeHtml(row.name)}</td>
              <td class="number">${row.code}</td>
              <td>${escapeHtml(row.level1)}</td>
              <td>${escapeHtml(row.level2)}</td>
              <td>${escapeHtml(row.level3)}</td>
              <td>${escapeHtml(row.level4)}</td>
              <td><span class="pill ${row.macro}">${escapeHtml(row.macro)}</span></td>
              <td class="action-cell">
                <button class="table-action" data-action="edit-category" data-code="${row.code}" type="button">Editar</button>
                <button class="table-action danger" data-action="delete-category" data-code="${row.code}" type="button">Excluir</button>
              </td>
            </tr>
          `,
        )
        .join("")}
    </tbody>
  `;
}

function renderImports() {
  renderImportHistory();
}

function renderImportHistory() {
  const history = readStorage(storageKeys.importHistory).slice(0, 30);
  $("#importHistoryTable").innerHTML = `
    <thead>
      <tr>
        <th>Data</th>
        <th>Base atualizada</th>
        <th>Arquivo</th>
        <th class="number">Linhas</th>
      </tr>
    </thead>
    <tbody>
      ${history.length
        ? history.map((item) => `
          <tr>
            <td>${escapeHtml(item.date)}</td>
            <td>${escapeHtml(importBaseLabel(item.kind))}</td>
            <td>${escapeHtml(item.fileName || "-")}</td>
            <td class="number">${integer.format(item.count || 0)}</td>
          </tr>
        `).join("")
        : `<tr><td colspan="4">Nenhuma importação registrada.</td></tr>`}
    </tbody>
  `;
}

function importBaseLabel(kind) {
  const labels = {
    regular: "Lançamentos",
    card: "Cartão de crédito",
    investments: "Investimentos",
    income: "Proventos/Rendimentos",
  };
  return labels[kind] || "Lançamentos";
}

function renderAccounts() {
  const rows = state.data.accounts
    .filter((account) => {
      if (state.accountType !== "all" && account.type !== state.accountType) return false;
      if (state.accountStatus === "active" && account.active === false) return false;
      if (state.accountStatus === "inactive" && account.active !== false) return false;
      if (!state.accountSearch) return true;
      const haystack = `${account.name} ${account.institution} ${account.type} ${account.active === false ? "inativa" : "ativa"}`.toLowerCase();
      return haystack.includes(state.accountSearch.toLowerCase());
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  $("#accountCountLabel").textContent = `${integer.format(rows.length)} contas`;
  $("#accountsTable").innerHTML = `
    <thead>
      <tr>
        <th>Conta</th>
        <th>Instituição</th>
        <th>Tipo</th>
        <th>Status</th>
        <th class="money">Saldo inicial</th>
        <th>Data inicial</th>
        <th>Origem</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((account) => `
        <tr>
          <td>${escapeHtml(account.name)}</td>
          <td>${escapeHtml(account.institution)}</td>
          <td><span class="pill">${escapeHtml(account.type)}</span></td>
          <td><span class="pill ${account.active === false ? "inactive" : "active"}">${account.active === false ? "Inativa" : "Ativa"}</span></td>
          ${amountCell(account.openingBalance || 0, true)}
          <td>${escapeHtml(formatDateShort(account.openingDate || "2022-12-31"))}</td>
          <td>${escapeHtml(account.source)}</td>
          <td class="action-cell">
            <button class="table-action" data-action="edit-account" data-name="${escapeHtml(account.name)}" type="button">Editar</button>
            <button class="table-action danger" data-action="delete-account" data-name="${escapeHtml(account.name)}" type="button">Excluir</button>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderInvestments() {
  const rows = [...(state.data.investments || [])]
    .filter((item) => {
      if (state.investmentType !== "all" && item.assetType !== state.investmentType) return false;
      if (state.investmentOperation !== "all" && item.operation !== state.investmentOperation) return false;
      if (!state.investmentSearch) return true;
      const haystack = `${item.ticker} ${item.assetName} ${item.broker} ${item.operation}`.toLowerCase();
      return haystack.includes(state.investmentSearch.toLowerCase());
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $("#investmentTradeCountLabel").textContent = `${integer.format(rows.length)} movimentos`;
  renderInvestmentListSummary(rows);
  $("#investmentsTable").innerHTML = `
    <thead>
      <tr>
        <th>Data</th>
        <th>Operação</th>
        <th>Tipo</th>
        <th>Ticker</th>
        <th>Ativo</th>
        <th class="number">Qtd.</th>
        <th class="money">Preço</th>
        <th class="money">Taxas</th>
        <th class="money">Total</th>
        <th>Corretora</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length ? rows.map((item) => investmentRow(item)).join("") : `<tr><td colspan="11">Nenhum movimento cadastrado.</td></tr>`}
    </tbody>
  `;
}

function renderInvestmentListSummary(rows) {
  const buys = rows.filter((item) => item.operation !== "venda").reduce((sum, item) => sum + investmentTradeAmount(item), 0);
  const sells = rows.filter((item) => item.operation === "venda").reduce((sum, item) => sum + investmentTradeAmount(item), 0);
  const quantity = rows.reduce((sum, item) => sum + (item.operation === "venda" ? -Number(item.quantity || 0) : Number(item.quantity || 0)), 0);
  const balance = buys - sells;
  const avgPrice = quantity > 0 ? balance / quantity : 0;
  $("#investmentListBalance").textContent = formatMoney(balance, true);
  $("#investmentListBalance").className = moneyClass(balance);
  $("#investmentListBuys").textContent = formatMoney(-buys, true);
  $("#investmentListBuys").className = "negative";
  $("#investmentListSells").textContent = formatMoney(sells, true);
  $("#investmentListSells").className = moneyClass(sells);
  $("#investmentListAvgPrice").textContent = currencyCents.format(avgPrice);
}

function investmentRow(item) {
  const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const total = item.operation === "venda" ? gross - Number(item.fees || 0) : gross + Number(item.fees || 0);
  return `
    <tr>
      <td>${escapeHtml(formatDateShort(item.date))}</td>
      <td><span class="pill ${item.operation === "venda" ? "receita" : "investimento"}">${escapeHtml(titleCase(item.operation))}</span></td>
      <td>${escapeHtml(titleCase(item.assetType))}</td>
      <td><strong>${escapeHtml(item.ticker)}</strong></td>
      <td>${escapeHtml(item.assetName || "-")}</td>
      <td class="number">${formatQuantity(item.quantity || 0)}</td>
      ${amountCell(item.unitPrice || 0, true)}
      ${amountCell(item.fees || 0, true)}
      ${amountCell(total, true)}
      <td>${escapeHtml(item.broker || "-")}</td>
      <td class="action-cell">
        <button class="table-action" data-action="edit-investment" data-id="${escapeHtml(item.id)}" type="button">Editar</button>
        <button class="table-action danger" data-action="delete-investment" data-id="${escapeHtml(item.id)}" type="button">Excluir</button>
      </td>
    </tr>
  `;
}

function renderIncome() {
  const rows = [...(state.data.incomes || [])]
    .filter((item) => {
      if (state.incomeType !== "all" && item.type !== state.incomeType) return false;
      if (!state.incomeSearch) return true;
      const haystack = `${item.ticker} ${item.type} ${item.account} ${item.notes}`.toLowerCase();
      return haystack.includes(state.incomeSearch.toLowerCase());
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $("#incomeCountLabel").textContent = `${integer.format(rows.length)} registros`;
  $("#incomeTable").innerHTML = `
    <thead>
      <tr>
        <th>Data</th>
        <th>Tipo</th>
        <th>Ticker</th>
        <th class="money">Valor</th>
        <th class="number">Qtd. base</th>
        <th>Conta</th>
        <th>Observação</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length ? rows.map((item) => incomeRow(item)).join("") : `<tr><td colspan="8">Nenhum provento cadastrado.</td></tr>`}
    </tbody>
  `;
}

function renderInvestmentAssets() {
  const rows = [...(state.data.investmentAssets || [])]
    .filter((item) => {
      if (state.investmentAssetType !== "all" && item.type !== state.investmentAssetType) return false;
      if (!state.investmentAssetSearch) return true;
      const haystack = `${item.ticker} ${item.name} ${item.type} ${item.currency} ${item.broker}`.toLowerCase();
      return haystack.includes(state.investmentAssetSearch.toLowerCase());
    })
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  $("#investmentAssetCountLabel").textContent = `${integer.format(rows.length)} tickers`;
  $("#investmentAssetsTable").innerHTML = `
    <thead>
      <tr>
        <th>Ticker</th>
        <th>Tipo</th>
        <th>Nome do ativo</th>
        <th>Moeda</th>
        <th>Corretora padrão</th>
        <th>Origem</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length ? rows.map((item) => `
        <tr>
          <td><strong>${escapeHtml(item.ticker)}</strong></td>
          <td><span class="pill investimento">${escapeHtml(titleCase(item.type))}</span></td>
          <td>${escapeHtml(item.name || "-")}</td>
          <td>${escapeHtml(item.currency || "BRL")}</td>
          <td>${escapeHtml(item.broker || "-")}</td>
          <td>${escapeHtml(item.source || "manual")}</td>
          <td class="action-cell">
            <button class="table-action" data-action="edit-investment-asset" data-ticker="${escapeHtml(item.ticker)}" type="button">Editar</button>
            <button class="table-action danger" data-action="delete-investment-asset" data-ticker="${escapeHtml(item.ticker)}" type="button">Excluir</button>
          </td>
        </tr>
      `).join("") : `<tr><td colspan="7">Nenhum ticker cadastrado.</td></tr>`}
    </tbody>
  `;
}

function incomeRow(item) {
  return `
    <tr>
      <td>${escapeHtml(formatDateShort(item.date))}</td>
      <td><span class="pill receita">${escapeHtml(titleCase(item.type))}</span></td>
      <td><strong>${escapeHtml(item.ticker)}</strong></td>
      ${amountCell(item.amount || 0, true)}
      <td class="number">${item.quantity ? formatQuantity(item.quantity) : "-"}</td>
      <td>${escapeHtml(item.account || "-")}</td>
      <td>${escapeHtml(item.notes || "-")}</td>
      <td class="action-cell">
        <button class="table-action" data-action="edit-income" data-id="${escapeHtml(item.id)}" type="button">Editar</button>
        <button class="table-action danger" data-action="delete-income" data-id="${escapeHtml(item.id)}" type="button">Excluir</button>
      </td>
    </tr>
  `;
}

function renderInvestmentDashboard() {
  refreshInvestmentDashboardFilters();
  const trades = filteredInvestmentDashboardTrades();
  const incomes = filteredInvestmentDashboardIncomes();
  const buys = trades.filter((item) => item.operation !== "venda").reduce((sum, item) => sum + investmentTradeAmount(item), 0);
  const sells = trades.filter((item) => item.operation === "venda").reduce((sum, item) => sum + investmentTradeAmount(item), 0);
  const incomeTotal = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const net = sells + incomeTotal - buys;
  const position = buys - sells;

  $("#investmentDashBuys").textContent = formatMoney(-buys);
  $("#investmentDashBuys").className = "negative";
  $("#investmentDashSells").textContent = formatMoney(sells);
  $("#investmentDashSells").className = moneyClass(sells);
  $("#investmentDashIncome").textContent = formatMoney(incomeTotal);
  $("#investmentDashIncome").className = moneyClass(incomeTotal);
  $("#investmentDashNet").textContent = formatMoney(net);
  $("#investmentDashNet").className = moneyClass(net);
  $("#investmentDashPosition").textContent = formatMoney(position);
  $("#investmentDashPosition").className = moneyClass(position);

  renderInvestmentMonthlyChart(trades, incomes);
  renderInvestmentTypeList(trades);
  renderInvestmentTickerList(trades, incomes);
  renderIncomeTypeList(incomes);
}

function filteredInvestmentDashboardTrades() {
  return [...(state.data.investments || [])].filter((item) => {
    if (!isInInvestmentDashboardPeriod(item.date)) return false;
    if (state.investmentDashboardType !== "all" && item.assetType !== state.investmentDashboardType) return false;
    if (state.investmentDashboardTicker !== "all" && item.ticker !== state.investmentDashboardTicker) return false;
    return true;
  });
}

function filteredInvestmentDashboardIncomes() {
  return [...(state.data.incomes || [])].filter((item) => {
    const asset = investmentAssetByTicker(item.ticker);
    if (!isInInvestmentDashboardPeriod(item.date)) return false;
    if (state.investmentDashboardType !== "all" && (asset?.type || "outro") !== state.investmentDashboardType) return false;
    if (state.investmentDashboardTicker !== "all" && item.ticker !== state.investmentDashboardTicker) return false;
    return true;
  });
}

function isInInvestmentDashboardPeriod(date) {
  const year = String(date || "").slice(0, 4);
  if (!/^\d{4}$/.test(year)) return false;
  return state.investmentDashboardYear === "all" || year === state.investmentDashboardYear;
}

function investmentTradeAmount(item) {
  const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const fees = Number(item.fees || 0);
  return item.operation === "venda" ? gross - fees : gross + fees;
}

function renderInvestmentMonthlyChart(trades, incomes) {
  const months = [...new Set([
    ...trades.map((item) => String(item.date || "").slice(0, 7)),
    ...incomes.map((item) => String(item.date || "").slice(0, 7)),
  ].filter((month) => /^\d{4}-\d{2}$/.test(month)))].sort();
  $("#investmentDashRangeLabel").textContent = investmentDashboardRangeLabel(months);
  if (!months.length) {
    $("#investmentMonthlyChart").innerHTML = `<div class="empty-state">Nenhum dado para os filtros selecionados.</div>`;
    return;
  }
  const rows = months.map((month) => {
    const monthTrades = trades.filter((item) => String(item.date || "").slice(0, 7) === month);
    const monthIncome = incomes.filter((item) => String(item.date || "").slice(0, 7) === month);
    const buys = monthTrades.filter((item) => item.operation !== "venda").reduce((sum, item) => sum + investmentTradeAmount(item), 0);
    const sells = monthTrades.filter((item) => item.operation === "venda").reduce((sum, item) => sum + investmentTradeAmount(item), 0);
    const income = monthIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { month, buys, sells, income, net: sells + income - buys };
  });
  const max = Math.max(1, ...rows.flatMap((row) => [row.buys, row.sells, row.income, Math.abs(row.net)]));
  $("#investmentMonthlyChart").innerHTML = rows.map((row) => `
    <div class="investment-month-group">
      <div class="investment-month-bars">
        <span class="investment-bar sell" style="height:${Math.max(3, (row.sells / max) * 100)}%" title="Vendas: ${escapeHtml(formatMoney(row.sells))}"></span>
        <span class="investment-bar income" style="height:${Math.max(3, (row.income / max) * 100)}%" title="Proventos: ${escapeHtml(formatMoney(row.income))}"></span>
        <span class="investment-bar buy" style="height:${Math.max(3, (row.buys / max) * 100)}%" title="Compras: ${escapeHtml(formatMoney(-row.buys))}"></span>
      </div>
      <strong class="${moneyClass(row.net)}">${escapeHtml(formatCompactMoney(row.net))}</strong>
      <span>${escapeHtml(cashflowMonthLabel(row.month))}</span>
    </div>
  `).join("");
}

function investmentDashboardRangeLabel(months) {
  if (!months.length) return "";
  if (months.length === 1) return cashflowMonthLabel(months[0]);
  return `${cashflowMonthLabel(months[0])} a ${cashflowMonthLabel(months[months.length - 1])}`;
}

function renderInvestmentTypeList(trades) {
  const byType = new Map();
  trades.forEach((item) => {
    const type = item.assetType || "outro";
    const current = byType.get(type) || 0;
    const amount = investmentTradeAmount(item);
    byType.set(type, current + (item.operation === "venda" ? -amount : amount));
  });
  renderRankList("#investmentTypeList", [...byType.entries()]
    .map(([label, amount]) => ({ label: titleCase(label), amount }))
    .filter((item) => Math.abs(item.amount) > 0), true);
}

function renderInvestmentTickerList(trades, incomes) {
  const byTicker = new Map();
  trades.forEach((item) => {
    const current = byTicker.get(item.ticker) || { label: item.ticker, amount: 0, income: 0 };
    const amount = investmentTradeAmount(item);
    current.amount += item.operation === "venda" ? -amount : amount;
    byTicker.set(item.ticker, current);
  });
  incomes.forEach((item) => {
    const current = byTicker.get(item.ticker) || { label: item.ticker, amount: 0, income: 0 };
    current.income += Number(item.amount || 0);
    byTicker.set(item.ticker, current);
  });
  renderRankList("#investmentTickerList", [...byTicker.values()]
    .map((item) => ({ label: item.label, amount: item.amount, meta: `Proventos ${formatMoney(item.income)}` }))
    .filter((item) => Math.abs(item.amount) > 0 || item.meta !== `Proventos ${formatMoney(0)}`), true);
}

function renderIncomeTypeList(incomes) {
  const byType = new Map();
  incomes.forEach((item) => {
    const type = item.type || "outro";
    byType.set(type, (byType.get(type) || 0) + Number(item.amount || 0));
  });
  renderRankList("#incomeTypeList", [...byType.entries()]
    .map(([label, amount]) => ({ label: titleCase(label), amount })), false);
}

function renderRankList(selector, rows, signed = false) {
  const sorted = rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 8);
  const max = Math.max(1, ...sorted.map((item) => Math.abs(item.amount)));
  $(selector).innerHTML = sorted.length ? sorted.map((item) => `
    <div class="list-row">
      <div class="list-row-top">
        <span>${escapeHtml(item.label)}</span>
        <strong class="${signed ? moneyClass(item.amount) : ""}">${escapeHtml(formatMoney(item.amount))}</strong>
      </div>
      ${item.meta ? `<small class="row-meta">${escapeHtml(item.meta)}</small>` : ""}
      <div class="progress-track"><div class="progress-fill ${item.amount < 0 ? "negative-fill" : ""}" style="width:${Math.max(3, (Math.abs(item.amount) / max) * 100)}%"></div></div>
    </div>
  `).join("") : `<div class="empty-state">Sem dados para exibir.</div>`;
}

function amountCell(value, cents = false) {
  return `<td class="money ${moneyClass(value)}">${formatMoney(value, cents)}</td>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderNavigation();
  if (state.activeView === "dashboard") renderDashboard();
  if (state.activeView === "cashflow") renderCashflow();
  if (state.activeView === "transactions") renderTransactions();
  if (state.activeView === "cards") renderCards();
  if (state.activeView === "investmentDashboard") renderInvestmentDashboard();
  if (state.activeView === "investments") renderInvestments();
  if (state.activeView === "income") renderIncome();
  if (state.activeView === "investmentAssets") renderInvestmentAssets();
  if (state.activeView === "categories") renderCategories();
  if (state.activeView === "accounts") renderAccounts();
  if (state.activeView === "imports") renderImports();
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.activeView !== button.dataset.view) resetViewFilters(state.activeView);
      state.activeView = button.dataset.view;
      document.querySelectorAll(".top-nav .nav-group").forEach((group) => {
        group.open = false;
      });
      render();
    });
  });

  document.querySelectorAll(".top-nav .nav-group").forEach((group) => {
    group.addEventListener("toggle", () => {
      if (!group.open) return;
      document.querySelectorAll(".top-nav .nav-group").forEach((other) => {
        if (other !== group) other.open = false;
      });
    });
  });

  $("#monthFilter").addEventListener("change", (event) => {
    state.month = event.target.value;
    render();
  });

  $("#macroFilter").addEventListener("change", (event) => {
    state.macro = event.target.value;
    render();
  });

  $("#cashflowYearFilter").addEventListener("change", (event) => {
    state.cashflowYear = event.target.value;
    renderCashflow();
  });

  $("#cashflowMonthFilter").addEventListener("change", (event) => {
    state.cashflowMonth = event.target.value;
    renderCashflow();
  });

  $("#cashflowSourceFilter").addEventListener("change", (event) => {
    state.cashflowSource = event.target.value;
    renderCashflow();
  });

  $("#dashboardYearFilter").addEventListener("change", (event) => {
    state.dashboardYear = event.target.value;
    state.dashboardMonths = [];
    renderMonthChips($("#dashboardMonthFilter"), monthChipOptions(), state.dashboardMonths);
    renderDashboard();
  });

  $("#dashboardMonthFilter").addEventListener("click", (event) => {
    const button = event.target.closest("[data-month]");
    if (!button) return;
    const month = button.dataset.month;
    state.dashboardMonths = state.dashboardMonths.includes(month)
      ? state.dashboardMonths.filter((item) => item !== month)
      : [...state.dashboardMonths, month].sort();
    renderMonthChips($("#dashboardMonthFilter"), monthChipOptions(), state.dashboardMonths);
    renderDashboard();
  });

  $("#accountFilter").addEventListener("change", (event) => {
    state.account = event.target.value;
    render();
  });

  $("#cardAccountFilter").addEventListener("change", (event) => {
    state.cardAccount = event.target.value;
    renderCards();
  });

  $("#transactionTypeFilter").addEventListener("change", (event) => {
    state.transactionType = event.target.value;
    renderTransactions();
  });

  $("#cardTypeFilter").addEventListener("change", (event) => {
    state.cardType = event.target.value;
    renderCards();
  });

  $("#transactionStatusFilter").addEventListener("change", (event) => {
    state.transactionStatus = event.target.value;
    renderTransactions();
  });

  $("#cardStatusFilter").addEventListener("change", (event) => {
    state.cardStatus = event.target.value;
    renderCards();
  });

  $("#transactionSortFilter").addEventListener("change", (event) => {
    state.transactionSort = event.target.value;
    renderTransactions();
  });

  $("#cardSortFilter").addEventListener("change", (event) => {
    state.cardSort = event.target.value;
    renderCards();
  });

  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });

  $("#cardSearchInput").addEventListener("input", (event) => {
    state.cardSearch = event.target.value;
    renderCards();
  });

  $("#investmentSearchInput").addEventListener("input", (event) => {
    state.investmentSearch = event.target.value;
    renderInvestments();
  });

  $("#incomeSearchInput").addEventListener("input", (event) => {
    state.incomeSearch = event.target.value;
    renderIncome();
  });

  $("#investmentTypeFilter").addEventListener("change", (event) => {
    state.investmentType = event.target.value;
    renderInvestments();
  });

  $("#investmentOperationFilter").addEventListener("change", (event) => {
    state.investmentOperation = event.target.value;
    renderInvestments();
  });

  $("#incomeTypeFilter").addEventListener("change", (event) => {
    state.incomeType = event.target.value;
    renderIncome();
  });

  $("#investmentDashboardYearFilter").addEventListener("change", (event) => {
    state.investmentDashboardYear = event.target.value;
    renderInvestmentDashboard();
  });

  $("#investmentDashboardTypeFilter").addEventListener("change", (event) => {
    state.investmentDashboardType = event.target.value;
    renderInvestmentDashboard();
  });

  $("#investmentDashboardTickerFilter").addEventListener("change", (event) => {
    state.investmentDashboardTicker = event.target.value;
    renderInvestmentDashboard();
  });

  $("#investmentAssetSearchInput").addEventListener("input", (event) => {
    state.investmentAssetSearch = event.target.value;
    renderInvestmentAssets();
  });

  $("#investmentAssetTypeFilter").addEventListener("change", (event) => {
    state.investmentAssetType = event.target.value;
    renderInvestmentAssets();
  });

  $("#resetFilters").addEventListener("click", () => {
    state.month = "all";
    state.macro = "all";
    state.cashflowYear = "all";
    state.cashflowMonth = "all";
    state.cashflowSource = "all";
    state.dashboardYear = defaultDashboardYear();
    state.dashboardMonths = [];
    state.account = "all";
    state.search = "";
    state.transactionType = "all";
    state.transactionStatus = "all";
    state.accountStatus = "all";
    state.cardAccount = "all";
    state.cardSearch = "";
    state.cardType = "all";
    state.cardStatus = "all";
    state.transactionSort = "date_desc";
    state.cardSort = "date_desc";
    state.investmentDashboardYear = defaultInvestmentDashboardYear();
    state.investmentDashboardType = "all";
    state.investmentDashboardTicker = "all";
    state.investmentSearch = "";
    state.investmentType = "all";
    state.investmentOperation = "all";
    state.investmentAssetSearch = "";
    state.investmentAssetType = "all";
    state.incomeSearch = "";
    state.incomeType = "all";
    $("#searchInput").value = "";
    $("#cardSearchInput").value = "";
    $("#investmentSearchInput").value = "";
    $("#investmentAssetSearchInput").value = "";
    $("#incomeSearchInput").value = "";
    initFilters();
    render();
  });

  $("#newCategoryButton").addEventListener("click", openNewCategoryModal);
  $("#newTransactionButton").addEventListener("click", () => openNewTransactionModal("regular"));
  $("#newCardTransactionButton").addEventListener("click", () => openNewTransactionModal("card"));
  $("#newInvestmentTradeButton").addEventListener("click", openNewInvestmentModal);
  $("#newIncomeButton").addEventListener("click", openNewIncomeModal);
  $("#newInvestmentAssetButton").addEventListener("click", openNewInvestmentAssetModal);
  document.querySelectorAll("[data-template-kind]").forEach((button) => {
    button.addEventListener("click", () => downloadTransactionTemplate(resolveImportKind(button.dataset.templateKind)));
  });
  document.querySelectorAll("[data-import-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pendingImportKind = resolveImportKind(button.dataset.importKind);
      $("#importExcelFile").click();
    });
  });
  $("#importExcelFile").addEventListener("change", handleTransactionImportFile);
  $("#newAccountButton").addEventListener("click", openNewAccountModal);

  $("#closeCategoryEditModal").addEventListener("click", closeCategoryEditModal);
  $("#cancelCategoryEditModal").addEventListener("click", closeCategoryEditModal);
  $("#categoryEditModal").addEventListener("click", (event) => {
    if (event.target.id === "categoryEditModal") closeCategoryEditModal();
  });

  ["#editCategoryLevel1", "#editCategoryLevel2", "#editCategoryLevel3"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      refreshEditCategoryLevelOptions();
    });
  });

  $("#editCategoryLevel4").addEventListener("change", () => {
    if (!Number($("#editCategoryOriginalCode").value || 0)) {
      $("#editCategoryCode").value = suggestCategoryCode();
    }
  });

  $("#editCategoryMacro").addEventListener("change", () => {
    if (!Number($("#editCategoryOriginalCode").value || 0)) {
      $("#editCategoryCode").value = suggestCategoryCode();
    }
  });

  $("#categoryEditForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedCategory();
  });

  $("#closeTransactionEditModal").addEventListener("click", closeTransactionEditModal);
  $("#cancelTransactionEditModal").addEventListener("click", closeTransactionEditModal);
  $("#transactionEditModal").addEventListener("click", (event) => {
    if (event.target.id === "transactionEditModal") closeTransactionEditModal();
  });

  $("#transactionEditForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedTransaction();
  });

  ["#editTxCompetenceDate", "#editTxPaymentDate"].forEach((selector) => {
    $(selector).addEventListener("input", (event) => maskDateShortInput(event.target));
  });

  $("#editTxAccountType").addEventListener("change", () => {
    refreshTransactionAccountOptions();
  });

  ["#editTxLevel1", "#editTxLevel2", "#editTxLevel3", "#editTxLevel4"].forEach((selector) => {
    $(selector).addEventListener("change", () => refreshTransactionCategorySelects());
  });

  $("#closeAccountEditModal").addEventListener("click", closeAccountEditModal);
  $("#cancelAccountEditModal").addEventListener("click", closeAccountEditModal);
  $("#accountEditModal").addEventListener("click", (event) => {
    if (event.target.id === "accountEditModal") closeAccountEditModal();
  });

  $("#accountEditForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedAccount();
  });

  $("#editAccountOpeningDate").addEventListener("input", (event) => maskDateShortInput(event.target));

  $("#closeInvestmentEditModal").addEventListener("click", closeInvestmentEditModal);
  $("#cancelInvestmentEditModal").addEventListener("click", closeInvestmentEditModal);
  $("#investmentEditModal").addEventListener("click", (event) => {
    if (event.target.id === "investmentEditModal") closeInvestmentEditModal();
  });
  $("#investmentEditForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedInvestment();
  });
  $("#editInvestmentDate").addEventListener("input", (event) => maskDateShortInput(event.target));
  $("#editInvestmentTicker").addEventListener("change", () => applyInvestmentAssetToInvestmentForm());

  $("#closeIncomeEditModal").addEventListener("click", closeIncomeEditModal);
  $("#cancelIncomeEditModal").addEventListener("click", closeIncomeEditModal);
  $("#incomeEditModal").addEventListener("click", (event) => {
    if (event.target.id === "incomeEditModal") closeIncomeEditModal();
  });
  $("#incomeEditForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedIncome();
  });
  $("#editIncomeDate").addEventListener("input", (event) => maskDateShortInput(event.target));
  $("#editIncomeTicker").addEventListener("change", () => applyInvestmentAssetToIncomeForm());

  $("#closeInvestmentAssetEditModal").addEventListener("click", closeInvestmentAssetEditModal);
  $("#cancelInvestmentAssetEditModal").addEventListener("click", closeInvestmentAssetEditModal);
  $("#investmentAssetEditModal").addEventListener("click", (event) => {
    if (event.target.id === "investmentAssetEditModal") closeInvestmentAssetEditModal();
  });
  $("#investmentAssetEditForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedInvestmentAsset();
  });

  $("#transactionsTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-transaction") editTransaction(button.dataset.id);
    if (button.dataset.action === "duplicate-transaction") duplicateTransaction(button.dataset.id);
    if (button.dataset.action === "delete-transaction") deleteTransaction(button.dataset.id);
  });

  $("#cardsTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-transaction") editTransaction(button.dataset.id);
    if (button.dataset.action === "duplicate-transaction") duplicateTransaction(button.dataset.id);
    if (button.dataset.action === "delete-transaction") deleteTransaction(button.dataset.id);
  });

  $("#accountsTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const name = button.dataset.name;
    if (button.dataset.action === "edit-account") editAccount(name);
    if (button.dataset.action === "delete-account") deleteAccount(name);
  });

  $("#investmentsTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-investment") editInvestment(button.dataset.id);
    if (button.dataset.action === "delete-investment") deleteInvestment(button.dataset.id);
  });

  $("#incomeTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-income") editIncome(button.dataset.id);
    if (button.dataset.action === "delete-income") deleteIncome(button.dataset.id);
  });

  $("#investmentAssetsTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-investment-asset") editInvestmentAsset(button.dataset.ticker);
    if (button.dataset.action === "delete-investment-asset") deleteInvestmentAsset(button.dataset.ticker);
  });

  $("#accountSearchInput").addEventListener("input", (event) => {
    state.accountSearch = event.target.value;
    renderAccounts();
  });

  $("#accountTypeFilter").addEventListener("change", (event) => {
    state.accountType = event.target.value;
    renderAccounts();
  });

  $("#accountStatusFilter").addEventListener("change", (event) => {
    state.accountStatus = event.target.value;
    renderAccounts();
  });

  $("#categoriesTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const code = Number(button.dataset.code);
    if (button.dataset.action === "edit-category") editCategory(code);
    if (button.dataset.action === "delete-category") deleteCategory(code);
  });

  $("#categorySearchInput").addEventListener("input", (event) => {
    state.categorySearch = event.target.value;
    renderCategories();
  });

  $("#categoryTypeFilter").addEventListener("change", (event) => {
    state.categoryType = event.target.value;
    renderCategories();
  });

  $("#categoryLevel1Filter").addEventListener("change", (event) => {
    state.categoryLevel1 = event.target.value;
    state.categoryLevel2 = "all";
    refreshCategoryFilters();
    renderCategories();
  });

  $("#categoryLevel2Filter").addEventListener("change", (event) => {
    state.categoryLevel2 = event.target.value;
    renderCategories();
  });
}

function resetViewFilters(view) {
  if (view === "dashboard") {
    state.dashboardYear = defaultDashboardYear();
    state.dashboardMonths = [];
  }
  if (view === "cashflow") {
    state.month = "all";
    state.macro = "all";
    state.cashflowYear = "all";
    state.cashflowMonth = "all";
    state.cashflowSource = "all";
  }
  if (view === "transactions") {
    state.account = "all";
    state.search = "";
    state.transactionType = "all";
    state.transactionStatus = "all";
    state.transactionSort = "date_desc";
    $("#searchInput").value = "";
  }
  if (view === "cards") {
    state.cardAccount = "all";
    state.cardSearch = "";
    state.cardType = "all";
    state.cardStatus = "all";
    state.cardSort = "date_desc";
    $("#cardSearchInput").value = "";
  }
  if (view === "investments") {
    state.investmentSearch = "";
    state.investmentType = "all";
    state.investmentOperation = "all";
    $("#investmentSearchInput").value = "";
  }
  if (view === "investmentAssets") {
    state.investmentAssetSearch = "";
    state.investmentAssetType = "all";
    $("#investmentAssetSearchInput").value = "";
  }
  if (view === "income") {
    state.incomeSearch = "";
    state.incomeType = "all";
    $("#incomeSearchInput").value = "";
  }
  if (view === "accounts") {
    state.accountSearch = "";
    state.accountType = "all";
    state.accountStatus = "all";
    $("#accountSearchInput").value = "";
  }
  if (view === "categories") {
    state.categorySearch = "";
    state.categoryType = "all";
    state.categoryLevel1 = "all";
    state.categoryLevel2 = "all";
    $("#categorySearchInput").value = "";
  }
}

function editCategory(code) {
  const category = state.data.categories.find((item) => Number(item.code) === code);
  if (!category) return;
  $("#categoryEditTitle").textContent = "Editar categoria";
  $("#saveCategoryModalButton").textContent = "Salvar alterações";
  $("#editCategoryOriginalCode").value = category.code;
  $("#editCategoryCode").value = category.code;
  $("#editCategoryName").value = category.name;
  $("#editCategoryLevel1").value = category.level1 || "";
  refreshEditCategoryLevelOptions();
  $("#editCategoryLevel2").value = category.level2 || "";
  refreshEditCategoryLevelOptions();
  $("#editCategoryLevel3").value = category.level3 || "";
  refreshEditCategoryLevelOptions();
  $("#editCategoryLevel4").value = category.level4 || "";
  $("#editCategoryMacro").value = category.macro;
  $("#categoryEditModal").hidden = false;
}

function openNewCategoryModal() {
  $("#categoryEditTitle").textContent = "Nova categoria";
  $("#saveCategoryModalButton").textContent = "Salvar categoria";
  $("#categoryEditForm").reset();
  $("#editCategoryOriginalCode").value = "";
  refreshCategoryHierarchySelects();
  $("#editCategoryCode").value = suggestCategoryCode();
  $("#categoryEditModal").hidden = false;
}

function closeCategoryEditModal() {
  $("#categoryEditModal").hidden = true;
  $("#categoryEditForm").reset();
  $("#editCategoryOriginalCode").value = "";
}

function saveEditedCategory() {
  const originalCode = Number($("#editCategoryOriginalCode").value);
  const code = Number($("#editCategoryCode").value);
  const name = $("#editCategoryName").value.trim();
  const level1 = $("#editCategoryLevel1").value;
  const level2 = $("#editCategoryLevel2").value;
  const level3 = $("#editCategoryLevel3").value;
  const level4 = $("#editCategoryLevel4").value;
  const macro = $("#editCategoryMacro").value;
  if (!code || !name || !level1) return;
  if ((!originalCode || code !== originalCode) && state.data.categories.some((category) => Number(category.code) === code)) {
    alert("Já existe uma categoria com esse código.");
    return;
  }

  const category = normalizeCategory({
    code,
    name,
    level1,
    level2,
    level3,
    level4,
    section: level2 || level1,
    group: level4 || level3 || level2 || level1,
    macro,
    local: true,
  });

  if (originalCode) {
    state.data.categories = state.data.categories.map((item) => Number(item.code) === originalCode ? category : item);
  } else {
    state.data.categories.push(category);
  }
  if (originalCode && code !== originalCode) {
    state.data.transactions = state.data.transactions.map((tx) => Number(tx.code) === originalCode ? { ...tx, code } : tx);
    const manualTransactions = readStorage(storageKeys.transactions).map((tx) => Number(tx.code) === originalCode ? { ...tx, code } : tx);
    writeStorage(storageKeys.transactions, manualTransactions);
    const codeMap = readCodeMap();
    codeMap.set(originalCode, code);
    writeCodeMap(codeMap);
  }

  const saved = readStorage(storageKeys.categories).filter((item) => Number(item.code) !== originalCode && Number(item.code) !== code);
  saved.push(category);
  writeStorage(storageKeys.categories, saved);
  writeStorage(storageKeys.deletedCategories, readStorage(storageKeys.deletedCategories).filter((item) => Number(item) !== Number(code)));
  state.data.categories.sort((a, b) => a.code - b.code);
  syncTransactionsWithCategories();
  refreshCategorySelects();
  refreshCategoryHierarchySelects();
  refreshCategoryFilters();
  closeCategoryEditModal();
  renderCategories();
}

function deleteCategory(code) {
  const hasTransactions = state.data.transactions.some((tx) => Number(tx.code) === code);
  if (hasTransactions) {
    alert("Essa categoria possui lançamentos. Reclassifique os lançamentos antes de excluir.");
    return;
  }
  if (!confirm("Excluir esta categoria do cadastro local?")) return;
  state.data.categories = state.data.categories.filter((category) => Number(category.code) !== code);
  writeStorage(storageKeys.categories, readStorage(storageKeys.categories).filter((category) => Number(category.code) !== code));
  const deleted = new Set(readStorage(storageKeys.deletedCategories).map(Number));
  deleted.add(code);
  writeStorage(storageKeys.deletedCategories, [...deleted]);
  refreshCategorySelects();
  refreshCategoryHierarchySelects();
  refreshCategoryFilters();
  renderCategories();
}

function openNewTransactionModal(kind = "regular") {
  state.transactionModalKind = kind;
  $("#transactionEditTitle").textContent = kind === "card" ? "Novo lançamento de cartão" : "Novo lançamento";
  $("#saveTransactionModalButton").textContent = "Salvar lançamento";
  $("#transactionEditForm").reset();
  $("#editTransactionId").value = "";
  $("#editTransactionKind").value = kind;
  refreshTransactionAccountControls(kind);
  refreshTransactionCategorySelects();
  const preferredAccount = state.data.accounts.find((account) => account.type === $("#editTxAccountType").value);
  if (preferredAccount) $("#editTxAccount").value = preferredAccount.name;
  const today = new Date().toISOString().slice(0, 10);
  $("#editTxCompetenceDate").value = formatDateShort(today);
  $("#editTxPaymentDate").value = "";
  $("#transactionEditModal").hidden = false;
}

function editTransaction(id) {
  const tx = state.data.transactions.find((item) => item.id === id);
  if (!tx) return;
  $("#transactionEditForm").reset();
  const kind = isCreditCardTransaction(tx) ? "card" : "regular";
  state.transactionModalKind = kind;
  $("#transactionEditTitle").textContent = "Editar lançamento";
  $("#saveTransactionModalButton").textContent = "Salvar alterações";
  $("#editTransactionId").value = tx.id;
  $("#editTransactionKind").value = kind;
  refreshTransactionAccountControls(kind, tx.account || "");
  $("#editTxDescription").value = tx.description || "";
  $("#editTxAccount").value = tx.account || "";
  $("#editTxLevel1").value = tx.level1 || "";
  refreshTransactionCategorySelects(Number(tx.code));
  $("#editTxLevel2").value = tx.level2 || "";
  refreshTransactionCategorySelects(Number(tx.code));
  $("#editTxLevel3").value = tx.level3 || "";
  refreshTransactionCategorySelects(Number(tx.code));
  $("#editTxLevel4").value = tx.level4 || "";
  refreshTransactionCategorySelects(Number(tx.code));
  $("#editTxCategory").value = String(tx.code);
  $("#editTxAmount").value = tx.amount;
  $("#editTxCompetenceDate").value = formatDateShort(tx.competenceDate || tx.paymentDate || "");
  $("#editTxPaymentDate").value = formatDateShort(tx.paymentDate || "");
  $("#transactionEditModal").hidden = false;
}

function duplicateTransaction(id) {
  const tx = state.data.transactions.find((item) => item.id === id);
  if (!tx) return;
  editTransaction(id);
  $("#editTransactionId").value = "";
  $("#transactionEditTitle").textContent = isCreditCardTransaction(tx) ? "Duplicar lançamento de cartão" : "Duplicar lançamento";
  $("#saveTransactionModalButton").textContent = "Salvar cópia";
}

function closeTransactionEditModal() {
  $("#transactionEditModal").hidden = true;
  $("#transactionEditForm").reset();
  $("#editTransactionId").value = "";
  $("#editTransactionKind").value = "";
}

function downloadTransactionTemplate(kind) {
  if (kind === "investments") return downloadSimpleTemplate(kind, [
    ["Data", "Operação", "Tipo", "Ticker", "Ativo", "Quantidade", "Preço Unitário", "Taxas", "Corretora", "Observação"],
    ["05/05/2026", "compra", "ação", "PETR4", "Petrobras PN", "100", "28,50", "0,00", "BTG", ""],
  ]);
  if (kind === "income") return downloadSimpleTemplate(kind, [
    ["Data", "Tipo", "Ticker", "Valor", "Quantidade Base", "Conta", "Observação"],
    ["05/05/2026", "dividendo", "PETR4", "120,00", "100", "BTG - Investimentos", ""],
  ]);
  const isCard = kind === "card";
  const account = state.data.accounts.find((item) => isCard ? item.type === "cartão de crédito" : item.type !== "cartão de crédito");
  const category = state.data.categories.find((item) => isCard ? item.macro === "despesa" : true) || state.data.categories[0];
  const rows = [
    ["Descrição", "Conta", "Código Categoria", "Valor", "Competência", "Pagamento"],
    ["Ex.: Compra supermercado", account?.name || "", category?.code || "", "-150,00", "05/05/2026", ""],
  ];
  const htmlRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  downloadHtmlXls(htmlRows, isCard ? "modelo_cartao_credito.xls" : "modelo_lancamentos.xls");
}

function downloadSimpleTemplate(kind, rows) {
  const htmlRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const fileNames = {
    investments: "modelo_investimentos.xls",
    income: "modelo_proventos.xls",
  };
  downloadHtmlXls(htmlRows, fileNames[kind] || "modelo_importacao.xls");
}

function downloadHtmlXls(htmlRows, fileName) {
  const html = `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <table>${htmlRows}</table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function resolveImportKind(kind) {
  if (kind === "transaction") return $("#transactionImportKind").value;
  return kind;
}

function handleTransactionImportFile(event) {
  const kind = state.pendingImportKind || "regular";
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = /\.xlsx$/i.test(file.name)
        ? parseXlsxWorkbook(reader.result)
        : parseImportTable(String(reader.result || ""));
      const imported = importRowsByKind(rows, kind);
      registerImportHistory(kind, file.name, imported);
      alert(`${imported} registro(s) importado(s).`);
      initFilters();
      render();
    } catch (error) {
      alert(error.message);
    } finally {
      input.value = "";
    }
  };
  if (/\.xlsx$/i.test(file.name)) reader.readAsArrayBuffer(file);
  else reader.readAsText(file, "UTF-8");
}

function importRowsByKind(rows, kind) {
  if (kind === "investments") return importInvestmentRows(rows);
  if (kind === "income") return importIncomeRows(rows);
  return importTransactionRows(rows, kind);
}

function registerImportHistory(kind, fileName, count) {
  const now = new Date();
  const date = `${formatDateShort(now.toISOString().slice(0, 10))} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const history = readStorage(storageKeys.importHistory);
  history.unshift({ id: `import-${Date.now()}`, date, kind, fileName, count });
  writeStorage(storageKeys.importHistory, history.slice(0, 100));
}

function parseImportTable(text) {
  const htmlRows = parseHtmlTable(text);
  if (htmlRows.length) return htmlRows;
  return parseDelimitedTable(text);
}

function parseXlsxWorkbook(buffer) {
  if (!window.XLSX) throw new Error("A biblioteca de leitura XLSX não carregou. Recarregue a página e tente novamente.");
  const workbook = window.XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, raw: false, defval: "" })
    .map((row) => row.map((cell) => String(cell || "").trim()))
    .filter((row) => row.some(Boolean));
}

function parseHtmlTable(text) {
  const documentFragment = new DOMParser().parseFromString(text, "text/html");
  const rows = [...documentFragment.querySelectorAll("tr")]
    .map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.textContent.trim()))
    .filter((row) => row.some(Boolean));
  return rows;
}

function parseDelimitedTable(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  return lines.map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

function importTransactionRows(rows, kind) {
  if (rows.length < 2) throw new Error("O arquivo não possui linhas para importar.");
  const headers = rows[0].map(normalizedText);
  const index = (names) => names.map(normalizedText).map((name) => headers.indexOf(name)).find((position) => position >= 0) ?? -1;
  const columns = {
    description: index(["Descrição", "Descricao"]),
    account: index(["Conta"]),
    code: index(["Código Categoria", "Codigo Categoria", "Código", "Codigo"]),
    amount: index(["Valor"]),
    competenceDate: index(["Competência", "Competencia"]),
    paymentDate: index(["Pagamento", "Data Pagamento", "Baixa"]),
  };
  const missing = Object.entries(columns)
    .filter(([key, position]) => key !== "paymentDate" && position < 0)
    .map(([key]) => key);
  if (missing.length) throw new Error("Layout inválido. Baixe e use o modelo XLS padrão.");

  const imported = [];
  const errors = [];
  rows.slice(1).forEach((row, position) => {
    if (!row.some((cell) => String(cell || "").trim())) return;
    const line = position + 2;
    const accountName = row[columns.account]?.trim();
    const account = state.data.accounts.find((item) => item.name === accountName);
    const code = Number(row[columns.code]);
    const category = state.data.categories.find((item) => Number(item.code) === code);
    const amount = parseImportAmount(row[columns.amount]);
    const competenceDate = parseImportDate(row[columns.competenceDate]);
    const paymentDate = columns.paymentDate >= 0 ? parseImportDate(row[columns.paymentDate]) : "";
    const description = row[columns.description]?.trim();
    const isCard = account ? account.type === "cartão de crédito" : false;

    if (!description || !account || !category || !Number.isFinite(amount) || !amount || !competenceDate) {
      errors.push(`Linha ${line}: revise descrição, conta, código, valor e competência.`);
      return;
    }
    if (account.active === false) {
      errors.push(`Linha ${line}: a conta informada está inativa no cadastro.`);
      return;
    }
    if (kind === "card" && !isCard) {
      errors.push(`Linha ${line}: a conta informada não é cartão de crédito.`);
      return;
    }
    if (kind === "regular" && isCard) {
      errors.push(`Linha ${line}: use uma conta corrente, poupança, investimento ou dinheiro.`);
      return;
    }

    imported.push(buildImportedTransaction({ account, category, amount, competenceDate, paymentDate, description, kind, line }));
  });

  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  if (!imported.length) throw new Error("Nenhum lançamento válido encontrado para importar.");
  const saved = readStorage(storageKeys.transactions);
  writeStorage(storageKeys.transactions, [...imported, ...saved]);
  state.data.transactions = [...imported, ...state.data.transactions];
  syncTransactionsWithCategories();
  return imported.length;
}

function importInvestmentRows(rows) {
  if (rows.length < 2) throw new Error("O arquivo não possui linhas para importar.");
  const headers = rows[0].map(normalizedText);
  const index = (names) => names.map(normalizedText).map((name) => headers.indexOf(name)).find((position) => position >= 0) ?? -1;
  const columns = {
    date: index(["Data"]),
    operation: index(["Operação", "Operacao", "Movimento"]),
    assetType: index(["Tipo", "Tipo Ativo"]),
    ticker: index(["Ticker", "Ativo"]),
    assetName: index(["Ativo", "Nome"]),
    quantity: index(["Quantidade", "Quant.", "Qtd."]),
    unitPrice: index(["Preço Unitário", "Preco Unitario", "Preço", "Preco"]),
    fees: index(["Taxas"]),
    broker: index(["Corretora", "Instituição", "Instituicao"]),
    notes: index(["Observação", "Observacao"]),
  };
  if ([columns.date, columns.operation, columns.assetType, columns.ticker, columns.quantity, columns.unitPrice].some((position) => position < 0)) {
    throw new Error("Layout inválido. Baixe e use o modelo XLS de investimentos.");
  }
  const imported = [];
  const errors = [];
  rows.slice(1).forEach((row, position) => {
    if (!row.some((cell) => String(cell || "").trim())) return;
    const line = position + 2;
    const date = parseImportDate(row[columns.date]);
    const operationValue = normalizedText(row[columns.operation]).includes("vend") || normalizedText(row[columns.operation]).includes("resgat") ? "venda" : "compra";
    const ticker = String(row[columns.ticker] || "").trim().toUpperCase();
    const quantity = parseImportAmount(row[columns.quantity]);
    const unitPrice = parseImportAmount(row[columns.unitPrice]);
    if (!date || !ticker || !Number.isFinite(quantity) || !quantity || !Number.isFinite(unitPrice) || !unitPrice) {
      errors.push(`Linha ${line}: revise data, ticker, quantidade e preço.`);
      return;
    }
    imported.push({
      id: `excel-investment-${Date.now()}-${line}`,
      date,
      operation: operationValue,
    assetType: canonicalAssetType(row[columns.assetType]),
      ticker,
      assetName: columns.assetName >= 0 ? String(row[columns.assetName] || "").trim() : "",
      quantity,
      unitPrice,
      fees: columns.fees >= 0 ? parseImportAmount(row[columns.fees]) || 0 : 0,
      broker: columns.broker >= 0 ? String(row[columns.broker] || "").trim() : "",
      notes: columns.notes >= 0 ? String(row[columns.notes] || "").trim() : "",
    });
  });
  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  if (!imported.length) throw new Error("Nenhum investimento válido encontrado para importar.");
  state.data.investments = [...imported, ...(state.data.investments || [])];
  imported.forEach(ensureInvestmentAssetFromRecord);
  writeStorage(storageKeys.investments, state.data.investments);
  return imported.length;
}

function importIncomeRows(rows) {
  if (rows.length < 2) throw new Error("O arquivo não possui linhas para importar.");
  const headers = rows[0].map(normalizedText);
  const index = (names) => names.map(normalizedText).map((name) => headers.indexOf(name)).find((position) => position >= 0) ?? -1;
  const columns = {
    date: index(["Data"]),
    type: index(["Tipo"]),
    ticker: index(["Ticker", "Produto", "Ativo"]),
    amount: index(["Valor", "Saldo Bruto", "Saldo bruto"]),
    quantity: index(["Quantidade Base", "Quantidade", "Qtd."]),
    account: index(["Conta", "Instituição", "Instituicao"]),
    notes: index(["Observação", "Observacao", "Descrição", "Descricao"]),
  };
  if ([columns.date, columns.type, columns.ticker, columns.amount].some((position) => position < 0)) {
    throw new Error("Layout inválido. Baixe e use o modelo XLS de proventos.");
  }
  const imported = [];
  const errors = [];
  rows.slice(1).forEach((row, position) => {
    if (!row.some((cell) => String(cell || "").trim())) return;
    const line = position + 2;
    const date = parseImportDate(row[columns.date]);
    const ticker = String(row[columns.ticker] || "").trim().toUpperCase();
    const amount = parseImportAmount(row[columns.amount]);
    if (!date || !ticker || !Number.isFinite(amount) || !amount) {
      errors.push(`Linha ${line}: revise data, ticker e valor.`);
      return;
    }
    imported.push({
      id: `excel-income-${Date.now()}-${line}`,
      date,
      type: normalizedText(row[columns.type]) || "outro",
      ticker,
      amount,
      quantity: columns.quantity >= 0 ? parseImportAmount(row[columns.quantity]) || 0 : 0,
      account: columns.account >= 0 ? String(row[columns.account] || "").trim() : "",
      notes: columns.notes >= 0 ? String(row[columns.notes] || "").trim() : "",
    });
  });
  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  if (!imported.length) throw new Error("Nenhum provento válido encontrado para importar.");
  state.data.incomes = [...imported, ...(state.data.incomes || [])];
  imported.forEach((item) => ensureInvestmentAssetFromRecord({ ticker: item.ticker, assetType: investmentAssetByTicker(item.ticker)?.type || "outro", assetName: item.ticker, broker: item.account }));
  writeStorage(storageKeys.incomes, state.data.incomes);
  return imported.length;
}

function buildImportedTransaction({ account, category, amount, competenceDate, paymentDate, description, kind, line }) {
  return {
    id: `excel-${kind}-${Date.now()}-${line}`,
    sheet: kind === "card" ? "Importação Cartão" : "Importação Lançamentos",
    account: account.name,
    institution: account.institution || account.name.split(" - ")[0] || "Importação",
    accountType: account.type,
    description,
    holder: "",
    amount: Math.round(amount * 100) / 100,
    code: Number(category.code),
    category: category.name,
    level1: category.level1,
    level2: category.level2,
    level3: category.level3,
    level4: category.level4,
    group: category.group,
    section: category.section,
    macro: category.macro,
    competenceDate,
    dueDate: paymentDate || null,
    paymentDate: paymentDate || null,
    month: paymentDate ? paymentDate.slice(0, 7) : "sem-data",
    status: paymentDate ? "importado" : "previsto",
  };
}

function saveEditedTransaction() {
  const existingId = $("#editTransactionId").value;
  const code = Number($("#editTxCategory").value);
  const category = state.data.categories.find((item) => Number(item.code) === code);
  const account = $("#editTxAccount").value;
  const amount = Number($("#editTxAmount").value);
  const paymentDate = parseDateShort($("#editTxPaymentDate").value);
  const competenceDate = parseDateShort($("#editTxCompetenceDate").value);
  const description = $("#editTxDescription").value.trim();
  if (!category || !account || account === "all" || !amount || !competenceDate || !description) {
    if (!competenceDate) alert("Informe a data de competência no padrão 00/00/0000.");
    return;
  }

  const tx = {
    id: existingId || `manual-${Date.now()}`,
    sheet: "Manual",
    account,
    institution: state.data.accounts.find((item) => item.name === account)?.institution || account.split(" - ")[0] || "Manual",
    accountType: state.data.accounts.find((item) => item.name === account)?.type || account.split(" - ")[1] || "Manual",
    description,
    holder: "",
    amount: Math.round(amount * 100) / 100,
    code,
    category: category.name,
    level1: category.level1,
    level2: category.level2,
    level3: category.level3,
    level4: category.level4,
    group: category.group,
    section: category.section,
    macro: category.macro,
    competenceDate,
    dueDate: paymentDate || null,
    paymentDate: paymentDate || null,
    month: paymentDate ? paymentDate.slice(0, 7) : "sem-data",
    status: paymentDate ? "manual" : "previsto",
  };

  const saved = readStorage(storageKeys.transactions).filter((item) => item.id !== tx.id);
  saved.unshift(tx);
  writeStorage(storageKeys.transactions, saved);
  const deleted = new Set(readStorage(storageKeys.deletedTransactions));
  deleted.delete(tx.id);
  writeStorage(storageKeys.deletedTransactions, [...deleted]);
    state.data.transactions = state.data.transactions.filter((item) => item.id !== tx.id);
    state.data.transactions.unshift(tx);
    const duplicates = findSimilarTransactions(tx, tx.id);
    if (duplicates.length) {
      alert(`Atenção: encontrei ${duplicates.length} possível(is) lançamento(s) duplicado(s) com mesma data, valor, conta e categoria.`);
    }
  closeTransactionEditModal();
  render();
}

function findSimilarTransactions(tx, ignoreId = "") {
  const key = duplicateTransactionKey(tx);
  if (!key) return [];
  return state.data.transactions.filter((item) => item.id !== ignoreId && duplicateTransactionKey(item) === key);
}

function duplicateTransactionKey(tx) {
  const date = tx.paymentDate || tx.competenceDate || "";
  if (!date || !tx.account || !tx.code || !Number.isFinite(Number(tx.amount))) return "";
  return [date, tx.account, Number(tx.code), Math.round(Number(tx.amount) * 100)].join("|");
}

function deleteTransaction(id) {
  if (!confirm("Excluir este lançamento?")) return;
  state.data.transactions = state.data.transactions.filter((tx) => tx.id !== id);
  writeStorage(storageKeys.transactions, readStorage(storageKeys.transactions).filter((tx) => tx.id !== id));
  const deleted = new Set(readStorage(storageKeys.deletedTransactions));
  deleted.add(id);
  writeStorage(storageKeys.deletedTransactions, [...deleted]);
  render();
}

function openNewInvestmentModal() {
  $("#investmentEditTitle").textContent = "Novo movimento";
  $("#saveInvestmentModalButton").textContent = "Salvar movimento";
  $("#investmentEditForm").reset();
  $("#editInvestmentId").value = "";
  refreshInvestmentFilters();
  $("#editInvestmentDate").value = formatDateShort(new Date().toISOString().slice(0, 10));
  $("#investmentEditModal").hidden = false;
}

function editInvestment(id) {
  const item = state.data.investments.find((row) => row.id === id);
  if (!item) return;
  $("#investmentEditTitle").textContent = "Editar movimento";
  $("#saveInvestmentModalButton").textContent = "Salvar alterações";
  $("#investmentEditForm").reset();
  refreshInvestmentFilters();
  $("#editInvestmentId").value = item.id;
  $("#editInvestmentDate").value = formatDateShort(item.date);
  $("#editInvestmentOperation").value = item.operation || "compra";
  $("#editInvestmentAssetType").value = item.assetType || "ação";
  $("#editInvestmentTicker").value = item.ticker || "";
  $("#editInvestmentAssetName").value = item.assetName || "";
  $("#editInvestmentQuantity").value = item.quantity || "";
  $("#editInvestmentUnitPrice").value = item.unitPrice || "";
  $("#editInvestmentFees").value = item.fees || "";
  $("#editInvestmentBroker").value = item.broker || "";
  $("#editInvestmentNotes").value = item.notes || "";
  $("#investmentEditModal").hidden = false;
}

function closeInvestmentEditModal() {
  $("#investmentEditModal").hidden = true;
  $("#investmentEditForm").reset();
}

function investmentAssetByTicker(ticker) {
  return (state.data.investmentAssets || []).find((item) => item.ticker === String(ticker || "").trim().toUpperCase());
}

function applyInvestmentAssetToInvestmentForm() {
  const asset = investmentAssetByTicker($("#editInvestmentTicker").value);
  if (!asset) return;
  $("#editInvestmentAssetType").value = asset.type || "outro";
  if (!$("#editInvestmentAssetName").value) $("#editInvestmentAssetName").value = asset.name || "";
  if (!$("#editInvestmentBroker").value) $("#editInvestmentBroker").value = asset.broker || "";
}

function applyInvestmentAssetToIncomeForm() {
  const asset = investmentAssetByTicker($("#editIncomeTicker").value);
  if (!asset) return;
  if (!$("#editIncomeAccount").value) $("#editIncomeAccount").value = asset.broker || "";
}

function saveEditedInvestment() {
  const id = $("#editInvestmentId").value || `investment-${Date.now()}`;
  const date = parseDateShort($("#editInvestmentDate").value);
  const ticker = $("#editInvestmentTicker").value.trim().toUpperCase();
  const quantity = Number($("#editInvestmentQuantity").value);
  const unitPrice = Number($("#editInvestmentUnitPrice").value);
  if (!date || !ticker || !quantity || !unitPrice) return;
  const item = {
    id,
    date,
    operation: $("#editInvestmentOperation").value,
    assetType: $("#editInvestmentAssetType").value,
    ticker,
    assetName: $("#editInvestmentAssetName").value.trim(),
    quantity,
    unitPrice,
    fees: Number($("#editInvestmentFees").value || 0),
    broker: $("#editInvestmentBroker").value.trim(),
    notes: $("#editInvestmentNotes").value.trim(),
  };
  ensureInvestmentAssetFromRecord(item);
  state.data.investments = [item, ...(state.data.investments || []).filter((row) => row.id !== id)];
  writeStorage(storageKeys.investments, state.data.investments);
  closeInvestmentEditModal();
  renderInvestments();
}

function deleteInvestment(id) {
  if (!confirm("Excluir este movimento de investimento?")) return;
  state.data.investments = (state.data.investments || []).filter((row) => row.id !== id);
  writeStorage(storageKeys.investments, state.data.investments);
  renderInvestments();
}

function openNewIncomeModal() {
  $("#incomeEditTitle").textContent = "Novo provento";
  $("#saveIncomeModalButton").textContent = "Salvar provento";
  $("#incomeEditForm").reset();
  $("#editIncomeId").value = "";
  $("#editIncomeDate").value = formatDateShort(new Date().toISOString().slice(0, 10));
  $("#incomeEditModal").hidden = false;
}

function editIncome(id) {
  const item = state.data.incomes.find((row) => row.id === id);
  if (!item) return;
  $("#incomeEditTitle").textContent = "Editar provento";
  $("#saveIncomeModalButton").textContent = "Salvar alterações";
  $("#incomeEditForm").reset();
  $("#editIncomeId").value = item.id;
  $("#editIncomeDate").value = formatDateShort(item.date);
  $("#editIncomeType").value = item.type || "dividendo";
  $("#editIncomeTicker").value = item.ticker || "";
  $("#editIncomeAmount").value = item.amount || "";
  $("#editIncomeQuantity").value = item.quantity || "";
  $("#editIncomeAccount").value = item.account || "";
  $("#editIncomeNotes").value = item.notes || "";
  $("#incomeEditModal").hidden = false;
}

function closeIncomeEditModal() {
  $("#incomeEditModal").hidden = true;
  $("#incomeEditForm").reset();
}

function saveEditedIncome() {
  const id = $("#editIncomeId").value || `income-${Date.now()}`;
  const date = parseDateShort($("#editIncomeDate").value);
  const ticker = $("#editIncomeTicker").value.trim().toUpperCase();
  const amount = Number($("#editIncomeAmount").value);
  if (!date || !ticker || !amount) return;
  const item = {
    id,
    date,
    type: $("#editIncomeType").value,
    ticker,
    amount,
    quantity: Number($("#editIncomeQuantity").value || 0),
    account: $("#editIncomeAccount").value.trim(),
    notes: $("#editIncomeNotes").value.trim(),
  };
  ensureInvestmentAssetFromRecord({ ticker: item.ticker, assetType: investmentAssetByTicker(item.ticker)?.type || "outro", assetName: item.ticker, broker: item.account });
  state.data.incomes = [item, ...(state.data.incomes || []).filter((row) => row.id !== id)];
  writeStorage(storageKeys.incomes, state.data.incomes);
  closeIncomeEditModal();
  renderIncome();
}

function deleteIncome(id) {
  if (!confirm("Excluir este provento?")) return;
  state.data.incomes = (state.data.incomes || []).filter((row) => row.id !== id);
  writeStorage(storageKeys.incomes, state.data.incomes);
  renderIncome();
}

function ensureInvestmentAssetFromRecord(item) {
  const ticker = String(item.ticker || "").trim().toUpperCase();
  if (!ticker || investmentAssetByTicker(ticker)) return;
  state.data.investmentAssets = [
    normalizeInvestmentAsset({
      ticker,
      type: item.assetType || "outro",
      name: item.assetName || ticker,
      broker: item.broker || "",
      currency: inferInvestmentCurrency(ticker),
      source: "manual",
    }),
    ...(state.data.investmentAssets || []),
  ].sort((a, b) => a.ticker.localeCompare(b.ticker));
  persistInvestmentAssets();
  refreshInvestmentFilters();
}

function openNewInvestmentAssetModal() {
  $("#investmentAssetEditTitle").textContent = "Novo ticker";
  $("#saveInvestmentAssetModalButton").textContent = "Salvar ticker";
  $("#investmentAssetEditForm").reset();
  $("#editInvestmentAssetOriginalTicker").value = "";
  $("#editInvestmentAssetCurrency").value = "BRL";
  renderInvestmentReferenceLists();
  $("#investmentAssetEditModal").hidden = false;
}

function editInvestmentAsset(ticker) {
  const asset = investmentAssetByTicker(ticker);
  if (!asset) return;
  $("#investmentAssetEditTitle").textContent = "Editar ticker";
  $("#saveInvestmentAssetModalButton").textContent = "Salvar alterações";
  $("#investmentAssetEditForm").reset();
  renderInvestmentReferenceLists();
  $("#editInvestmentAssetOriginalTicker").value = asset.ticker;
  $("#editInvestmentAssetTicker").value = asset.ticker;
  $("#editInvestmentAssetTypeName").value = asset.type || "";
  $("#editInvestmentAssetNameField").value = asset.name || "";
  $("#editInvestmentAssetCurrency").value = asset.currency || "BRL";
  $("#editInvestmentAssetBroker").value = asset.broker || "";
  $("#editInvestmentAssetNotes").value = asset.notes || "";
  $("#investmentAssetEditModal").hidden = false;
}

function closeInvestmentAssetEditModal() {
  $("#investmentAssetEditModal").hidden = true;
  $("#investmentAssetEditForm").reset();
}

function saveEditedInvestmentAsset() {
  const originalTicker = $("#editInvestmentAssetOriginalTicker").value;
  const asset = normalizeInvestmentAsset({
    ticker: $("#editInvestmentAssetTicker").value,
    type: $("#editInvestmentAssetTypeName").value,
    name: $("#editInvestmentAssetNameField").value,
    currency: $("#editInvestmentAssetCurrency").value || "BRL",
    broker: $("#editInvestmentAssetBroker").value,
    notes: $("#editInvestmentAssetNotes").value,
    source: "manual",
  });
  if (!asset.ticker || !asset.type) return;
  if (asset.ticker !== originalTicker && state.data.investmentAssets.some((item) => item.ticker === asset.ticker)) {
    alert("Já existe um ticker com esse código.");
    return;
  }
  state.data.investmentAssets = [
    asset,
    ...(state.data.investmentAssets || []).filter((item) => item.ticker !== originalTicker && item.ticker !== asset.ticker),
  ].sort((a, b) => a.ticker.localeCompare(b.ticker));
  if (originalTicker) {
    state.data.investments = (state.data.investments || []).map((item) => {
      if (item.ticker !== originalTicker) return item;
      return {
        ...item,
        ticker: asset.ticker,
        assetType: asset.type,
        assetName: asset.name || item.assetName,
        broker: asset.broker || item.broker,
      };
    });
    state.data.incomes = (state.data.incomes || []).map((item) => {
      if (item.ticker !== originalTicker) return item;
      return {
        ...item,
        ticker: asset.ticker,
        account: asset.broker || item.account,
      };
    });
  }
  writeStorage(storageKeys.investments, state.data.investments || []);
  writeStorage(storageKeys.incomes, state.data.incomes || []);
  persistInvestmentAssets();
  refreshInvestmentFilters();
  closeInvestmentAssetEditModal();
  renderInvestmentAssets();
}

function deleteInvestmentAsset(ticker) {
  const used = (state.data.investments || []).some((item) => item.ticker === ticker) || (state.data.incomes || []).some((item) => item.ticker === ticker);
  if (used) {
    alert("Esse ticker possui movimentos ou proventos. Ajuste os registros antes de excluir.");
    return;
  }
  if (!confirm("Excluir este ticker do cadastro?")) return;
  state.data.investmentAssets = (state.data.investmentAssets || []).filter((item) => item.ticker !== ticker);
  persistInvestmentAssets();
  refreshInvestmentFilters();
  renderInvestmentAssets();
}

function persistInvestmentAssets() {
  writeStorage(storageKeys.investmentAssets, state.data.investmentAssets.map(normalizeInvestmentAsset));
}

function openNewAccountModal() {
  $("#accountEditTitle").textContent = "Nova conta";
  $("#saveAccountModalButton").textContent = "Salvar conta";
  $("#accountEditForm").reset();
  $("#editAccountOriginalName").value = "";
  $("#editAccountType").value = "corrente";
  $("#editAccountOpeningBalance").value = "0.00";
  $("#editAccountOpeningDate").value = "31/12/2022";
  $("#editAccountActive").value = "active";
  $("#accountEditModal").hidden = false;
}

function editAccount(name) {
  const account = state.data.accounts.find((item) => item.name === name);
  if (!account) return;
  $("#accountEditTitle").textContent = "Editar conta";
  $("#saveAccountModalButton").textContent = "Salvar alterações";
  $("#editAccountOriginalName").value = account.name;
  $("#editAccountName").value = account.name;
  $("#editAccountInstitution").value = account.institution || "";
  $("#editAccountType").value = account.type || "corrente";
  $("#editAccountOpeningBalance").value = Number(account.openingBalance || 0).toFixed(2);
  $("#editAccountOpeningDate").value = formatDateShort(account.openingDate || "2022-12-31");
  $("#editAccountActive").value = account.active === false ? "inactive" : "active";
  $("#accountEditModal").hidden = false;
}

function closeAccountEditModal() {
  $("#accountEditModal").hidden = true;
  $("#accountEditForm").reset();
  $("#editAccountOriginalName").value = "";
}

function saveEditedAccount() {
  const originalName = $("#editAccountOriginalName").value;
  const openingDate = parseDateShort($("#editAccountOpeningDate").value);
  const account = normalizeAccount({
    name: $("#editAccountName").value.trim(),
    institution: $("#editAccountInstitution").value.trim(),
    type: $("#editAccountType").value,
    openingBalance: Number($("#editAccountOpeningBalance").value || 0),
    openingDate,
    active: $("#editAccountActive").value !== "inactive",
    source: originalName ? "manual" : "manual",
  });
  if (!account.name) return;
  if (!openingDate) {
    alert("Informe a data do saldo inicial no padrão 00/00/0000.");
    return;
  }
  if ((!originalName || account.name !== originalName) && state.data.accounts.some((item) => item.name === account.name)) {
    alert("Já existe uma conta com esse nome.");
    return;
  }
  if (originalName && account.name !== originalName) {
    state.data.transactions = state.data.transactions.map((tx) => tx.account === originalName ? { ...tx, account: account.name } : tx);
    writeStorage(storageKeys.transactions, readStorage(storageKeys.transactions).map((tx) => tx.account === originalName ? { ...tx, account: account.name } : tx));
    if (state.account === originalName) state.account = account.name;
  }
  state.data.accounts = state.data.accounts.filter((item) => item.name !== originalName && item.name !== account.name);
  state.data.accounts.push(account);
  persistAccounts();
  closeAccountEditModal();
  initFilters();
  render();
}

function deleteAccount(name) {
  const hasTransactions = state.data.transactions.some((tx) => tx.account === name);
  if (hasTransactions) {
    alert("Essa conta possui lançamentos. Reclassifique ou exclua os lançamentos antes de remover a conta.");
    return;
  }
  if (!confirm("Excluir esta conta?")) return;
  state.data.accounts = state.data.accounts.filter((account) => account.name !== name);
  persistAccounts();
  initFilters();
  renderAccounts();
}

function persistAccounts() {
  writeStorage(storageKeys.accounts, state.data.accounts.map(normalizeAccount).sort((a, b) => a.name.localeCompare(b.name)));
}

async function boot() {
  if (window.FINANCE_DATA) {
    state.data = window.FINANCE_DATA;
  } else {
    const response = await fetch("./finance-data.json");
    state.data = await response.json();
  }
  await loadRemotePersistence();
  hydrateLocalData();
  state.dashboardYear = defaultDashboardYear();
  state.investmentDashboardYear = defaultInvestmentDashboardYear();
  initFilters();
  bindEvents();
  render();
}

boot().catch((error) => {
  document.body.innerHTML = `<main class="main"><h1>Não foi possível carregar os dados</h1><p>${escapeHtml(error.message)}</p></main>`;
});
