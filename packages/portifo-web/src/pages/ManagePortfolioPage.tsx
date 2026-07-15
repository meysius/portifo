import {
  IonAvatar,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import ActionSheetModal from "../components/ActionSheetModal";
import MemberSheet from "../components/MemberSheet";
import { ChevronRightIcon, ListDivider, MemberInitial, TrashIcon, roleLabel } from "../components/ds";
import type { MemberDto, MemberRole } from "../api/portfolio";
import { usePortfolioData } from "../context/PortfolioDataContext";
import { useTabBase } from "../context/TabBaseContext";
import { useToast } from "../context/ToastContext";

// Manage Portfolio (design-system Screens section): the active portfolio's
// Name field, its member roster, and Delete/Leave — reached from Settings'
// Portfolio row. Only an Owner can rename, add, or act on another member's
// row; an Editor/Viewer sees the same roster read-only and Leave Portfolio
// in place of Delete.
function ManagePortfolioPage() {
  const history = useHistory();
  const { tabBase, tabLabel } = useTabBase();
  const {
    portfolioDetail,
    renamePortfolio,
    deletePortfolio,
    leavePortfolio,
    members,
    loading,
    updateMemberRole,
    removeMember,
  } = usePortfolioData();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDto | null>(null);
  const [memberBusy, setMemberBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  useEffect(() => {
    if (portfolioDetail) setName(portfolioDetail.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioDetail?.name]);

  if (!portfolioDetail) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref={tabBase} text={tabLabel} />
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="chart-loading">
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const isOwner = portfolioDetail.role === "owner";

  const handleNameBlur = async () => {
    const trimmed = name.trim();
    if (!isOwner || !trimmed || trimmed === portfolioDetail.name) {
      setName(portfolioDetail.name);
      return;
    }
    setSaving(true);
    try {
      await renamePortfolio(trimmed);
      showToast("Portfolio renamed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to rename portfolio", { color: "danger" });
      setName(portfolioDetail.name);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (role: MemberRole) => {
    if (!selectedMember) return;
    setMemberBusy(true);
    try {
      await updateMemberRole(selectedMember.id, role);
      setSelectedMember(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update role", { color: "danger" });
    } finally {
      setMemberBusy(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedMember) return;
    setMemberBusy(true);
    try {
      await removeMember(selectedMember.id);
      setSelectedMember(null);
      showToast("Member removed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove member", { color: "danger" });
    } finally {
      setMemberBusy(false);
    }
  };

  const handleDeletePortfolio = async () => {
    try {
      await deletePortfolio();
      showToast("Portfolio deleted");
      history.replace(tabBase);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete portfolio", { color: "danger" });
    }
  };

  const handleLeavePortfolio = async () => {
    try {
      await leavePortfolio();
      showToast("Left portfolio");
      history.replace(tabBase);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to leave portfolio", { color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={tabBase} text={tabLabel} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="detail-hero">
          <div className="detail-symrow">
            <span className="detail-sym">{portfolioDetail.name}</span>
          </div>
          <div className="detail-name">Your role: {roleLabel(portfolioDetail.role)}</div>
        </div>

        <IonList inset className="fieldcard-list form-list">
          <IonItem>
            <IonLabel>Name</IonLabel>
            <IonInput
              slot="end"
              className="ion-text-end"
              value={name}
              disabled={!isOwner || saving}
              onIonInput={(e) => setName(e.detail.value ?? "")}
              onIonBlur={handleNameBlur}
            />
          </IonItem>
        </IonList>

        <ListDivider
          label="Members"
          onAdd={isOwner ? () => history.push(`${tabBase}/add-member`) : undefined}
          addLabel="Add member"
        />
        {loading.members && members.length === 0 ? (
          <div className="chart-loading">
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <IonList inset>
            {members.map((member) => {
              const canAct = isOwner && !member.isSelf;
              return (
                <IonItem
                  key={member.id}
                  button={canAct}
                  detail={false}
                  className={member.pending ? "row-closed" : undefined}
                  onClick={canAct ? () => setSelectedMember(member) : undefined}
                >
                  <IonAvatar slot="start" className="glyph glyph-member">
                    <MemberInitial label={member.name ?? member.email} />
                  </IonAvatar>
                  <IonLabel className={member.pending ? undefined : "sub-mono"}>
                    <h2>
                      {member.name ?? member.email}
                      {member.isSelf && " (You)"}
                    </h2>
                    <p>{member.pending ? "Pending · not signed in yet" : member.email}</p>
                  </IonLabel>
                  <span slot="end" className="type-tag">
                    {roleLabel(member.role)}
                  </span>
                  {canAct && (
                    <span slot="end" className="row-chevron" aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  )}
                </IonItem>
              );
            })}
          </IonList>
        )}

        <div className="btn-stack">
          {isOwner ? (
            <button type="button" className="btn btn-destructive" onClick={() => setDeleteConfirmOpen(true)}>
              Delete Portfolio
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setLeaveConfirmOpen(true)}>
              Leave Portfolio
            </button>
          )}
        </div>

        <MemberSheet
          member={selectedMember}
          busy={memberBusy}
          onClose={() => setSelectedMember(null)}
          onChangeRole={handleChangeRole}
          onRemove={handleRemoveMember}
        />

        <ActionSheetModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete Portfolio"
          subtitle="This cannot be undone"
          actions={[{ label: "Delete", icon: <TrashIcon />, destructive: true, onClick: handleDeletePortfolio }]}
        />
        <ActionSheetModal
          isOpen={leaveConfirmOpen}
          onClose={() => setLeaveConfirmOpen(false)}
          title="Leave Portfolio"
          subtitle="You'll lose access immediately"
          actions={[{ label: "Leave", icon: <TrashIcon />, destructive: true, onClick: handleLeavePortfolio }]}
        />
      </IonContent>
    </IonPage>
  );
}

export default ManagePortfolioPage;
