-- Support the verified CC BY-SA 3.0 vocal release alongside the initial CC BY 4.0 library.
begin;
alter table public.music_tracks drop constraint if exists music_tracks_license_code_check;
alter table public.music_tracks drop constraint if exists music_tracks_license_url_check;
alter table public.music_tracks drop constraint if exists music_tracks_license_pair_check;
alter table public.music_tracks add constraint music_tracks_license_pair_check check (
  (license_code = 'CC-BY-4.0' and license_url = 'https://creativecommons.org/licenses/by/4.0/') or
  (license_code = 'CC-BY-SA-3.0' and license_url = 'https://creativecommons.org/licenses/by-sa/3.0/')
);
commit;
