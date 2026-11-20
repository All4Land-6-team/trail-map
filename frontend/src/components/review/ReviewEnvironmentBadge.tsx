import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../common/Icon'
import type { ReviewEnvironment, PhotoWeatherCode } from '../../types/community'
import { photoTimePhase, type PhotoTimePhase } from '../../utils/sunTimes'
import { environmentPopoverPosition, type EnvironmentPopoverPosition } from '../../utils/environmentPopoverPosition'
import './review-environment.css'

const weatherIcons: Record<PhotoWeatherCode, { icon: IconName; label: string }> = {
  SUNNY: { icon: 'WeatherSunny', label: '맑음' },
  PARTLY_CLOUDY: { icon: 'WeatherPartlyCloudy', label: '구름 조금' },
  CLOUDY: { icon: 'WeatherCloudy', label: '흐림' },
  RAIN: { icon: 'WeatherRain', label: '비' },
  SNOW: { icon: 'WeatherSnow', label: '눈' },
  FOG: { icon: 'WeatherFog', label: '안개' },
  THUNDERSTORM: { icon: 'WeatherThunderstorm', label: '천둥번개' },
}

const timeIcons: Record<PhotoTimePhase, { icon: IconName; label: string }> = {
  NIGHT: { icon: 'WeatherNight', label: '밤' },
  SUNRISE: { icon: 'WeatherSunrise', label: '일출' },
  DAYTIME: { icon: 'WeatherDaytime', label: '낮' },
  SUNSET: { icon: 'WeatherSunset', label: '일몰' },
}

export function ReviewEnvironmentBadge({ environment, compact = false }: { environment?: ReviewEnvironment; compact?: boolean }) {
  const weatherCode = environment?.weatherCode
  const weather = weatherCode ? weatherIcons[weatherCode] : null
  const phaseCode = environment ? photoTimePhase(environment.referenceAt, [environment.longitude, environment.latitude]) : null
  const phase = phaseCode ? timeIcons[phaseCode] : null
  const temperature = environment?.temperatureC == null ? null : `${Math.round(environment.temperatureC)}℃`
  const size = compact ? 18 : 20
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<EnvironmentPopoverPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  const weatherDescription = weather ? `${weather.label}${temperature ? `, ${temperature}` : ''}` : ''
  const accessibleLabel = [weather && `날씨 ${weather.label}`, phase && `시간대 ${phase.label}`].filter(Boolean).join(', ')
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect()
    const popover = popoverRef.current?.getBoundingClientRect()
    if (!trigger || !popover) return
    setPosition(environmentPopoverPosition(trigger, popover, { width: window.innerWidth, height: window.innerHeight }))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: globalThis.PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape, true)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape, true)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const stopPointer = (event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()
  const toggle = (event: MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); setOpen(current => !current) }
  if (!weather && !phase) return null

  return <span className={`photo-environment${compact ? ' photo-environment--compact' : ''}`}>
    <button ref={triggerRef} type="button" className="photo-environment__trigger" aria-label={`${accessibleLabel} 상세 보기`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popoverId : undefined} onPointerDown={stopPointer} onClick={toggle}>
    {weather && <span className="photo-environment__item photo-environment__weather-item" role="img"
      aria-label={`날씨 ${weatherDescription}`} title={weatherDescription}>
      <Icon className={`photo-environment__weather photo-environment__weather--${weatherCode?.toLowerCase().replace('_', '-')}`}
        name={weather.icon} size={size} aria-hidden="true" />
    </span>}
    {weather && phase && <span className="photo-environment__separator" aria-hidden="true" />}
    {phase && <span className="photo-environment__item photo-environment__time-item">
      <Icon className={`photo-environment__time photo-environment__time--${phaseCode?.toLowerCase()}`} name={phase.icon} size={size} aria-hidden="true" />
    </span>}
    </button>
    {open && createPortal(<div ref={popoverRef} id={popoverId} role="dialog" aria-label="등산 당시 환경"
      className="photo-environment-popover" style={position ? { top: position.top, left: position.left } : { visibility: 'hidden' }}
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <strong className="photo-environment-popover__title">등산 당시 환경</strong>
      <dl className="photo-environment-popover__list">
        {weather && <div><dt>날씨</dt><dd><Icon className={`photo-environment__weather photo-environment__weather--${weatherCode?.toLowerCase().replace('_', '-')}`}
          name={weather.icon} size={22} aria-hidden="true" /><span>{weatherDescription}</span></dd></div>}
        {phase && <div><dt>시간대</dt><dd><Icon className={`photo-environment__time photo-environment__time--${phaseCode?.toLowerCase()}`}
          name={phase.icon} size={22} aria-hidden="true" /><span>{phase.label}</span></dd></div>}
      </dl>
    </div>, document.body)}
  </span>
}
