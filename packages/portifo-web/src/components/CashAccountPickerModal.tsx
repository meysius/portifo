import { useHistory } from "react-router-dom";
import { usePortfolioData } from "../context/PortfolioDataContext";
import PickerSheet from "./PickerSheet";

// Not wired into any live UI yet — Holdings' "Add Cash" action consumes this
// in a later phase. Pick an existing cash account (navigates straight to its
// detail page) or type a new name to create one.
function CashAccountPickerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const history = useHistory();
  const { accounts, createAccount } = usePortfolioData();

  const cashAccounts = accounts.filter((a) => a.type === "cash");

  const handleSelect = (accountId: string) => {
    history.push(`/cash-account/${accountId}`);
    onClose();
  };

  const handleCreate = async (name: string) => {
    try {
      const account = await createAccount({ name, type: "cash" });
      history.push(`/cash-account/${account.id}`);
    } finally {
      onClose();
    }
  };

  return (
    <PickerSheet
      mode="static"
      isOpen={isOpen}
      title="Cash Account"
      searchable
      allowCreate
      createLabel={(query) => `+ Create "${query}"`}
      options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
      onClose={onClose}
      onSelect={handleSelect}
      onCreate={handleCreate}
    />
  );
}

export default CashAccountPickerModal;
