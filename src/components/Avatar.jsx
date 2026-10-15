/* Shared avatar: text initial or uploaded photo (avatar = 'img:<dataUrl>') */
export default function Avatar({ user, avatar, size = '', className = '' }) {
  const a = String(avatar ?? user?.avatar ?? '');
  if (a.startsWith('img:') && a.length > 4) {
    return (
      <span className={`avatar ${size} ${className}`} style={{ overflow: 'hidden', padding: 0 }}>
        <img src={a.slice(4)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </span>
    );
  }
  return <span className={`avatar ${size} ${className}`}>{a || 'ส'}</span>;
}
