import { useRef } from "react";
import { Icon } from "../../../components/common/Icon";
import { TopBar } from "../../../components/layout";
import { SearchField } from "../../../components/discovery";

type HomeSearchBarProps = {
  isSearching: boolean;
  query: string;
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
};

export function HomeSearchBar({ isSearching, query, onOpen, onClose, onQueryChange, onSearch }: HomeSearchBarProps) {
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  function closeAndRestoreFocus() {
    onClose();
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  }

  return <div className="home-search">
    {isSearching
      ? <SearchField className="home-search__field" showLeadingIcon={false} autoFocus
          value={query} placeholder="산 이름 검색"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onSearch={onSearch}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); closeAndRestoreFocus(); }
          }} />
      : <TopBar className="home-search__bar" title="어느 산으로 떠날까요?"
          leading={<Icon name="Mountain" size={23} color="var(--af-green)" />}
          action={<button ref={searchButtonRef} type="button" className="af-top-bar__action"
            aria-label="산 검색 열기" onClick={onOpen}><Icon name="Search" size={22} /></button>} />}
  </div>;
}
