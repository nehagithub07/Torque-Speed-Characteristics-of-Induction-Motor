import rpmImg from '../assets/rpm.png'

const RpmMeter = ({ reading, readingsReady = false }) => {
  const speed = readingsReady ? reading.speed : 0

  return (
    <article className="rpm-meter" id="rpm-meter" aria-label="RPM meter">
      <img className="rpm-meter__image" src={rpmImg} alt="RPM indicator" draggable={false} />
      <output className={`rpm-meter__display ${readingsReady ? 'rpm-meter__display--running' : ''}`} aria-live="polite" aria-label={`Motor speed: ${speed} RPM`}>
        {speed}
      </output>
    </article>
  )
}

export default RpmMeter
