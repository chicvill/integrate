using System;
using UnityEngine;

namespace ModernClock
{
    public class ClockGenerator : MonoBehaviour
    {
        [SerializeField] private ClockConfigurationSO _configuration;
        [SerializeField] private ClockView _clockView;
        [SerializeField] private GameObject _timeViewPrefab;

        private ClockController<ClockView> _clockCOntroller;

        public void Start()
        {
            InitClocks();
        }

        /// <summary>
        /// Initialize and generate clock from configuration.
        /// </summary>
        private void InitClocks()
        {
            var clockModel = new ClockModel()
            {
                Format = _configuration.Format,
                StartPoint = _configuration.StartPoint,
                Time = DateTime.Now,
                H1 = _configuration.Format == TimeFormat.Hours24 ? 2 : 1,
                H2 = 9,
                M1 = 5,
                M2 = 9,
                S1 = 5,
                S2 = 9,
                LerpTime = _configuration.LerpTime,
                HighlightCurve = _configuration.HighlightCurve
            };

            _clockCOntroller = new ClockController<ClockView>();
            _clockCOntroller.Mediate(_clockView, clockModel);

            _clockCOntroller.InitTimeViews(_timeViewPrefab);
            _clockCOntroller.Start();
        }

        private void OnDestroy()
        {
            _clockCOntroller?.Unmediate();
        }
    }
}