d3.json("data.json").then(data => {
    // Parse the date and weight
    data.forEach(d => {
        d.date = new Date(d.Date);
        d.year = d.date.getFullYear();
        d.weight = +d.Weight;
    });

    // Get unique years for the dropdown
    const years = [...new Set(data.map(d => d.year))];
    const yearSelect = d3.select("#year-select");

    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);

    // Initial chart update with the first year in the list
    updateBarChart(data, years[0]);

    // Update chart on year selection change
    yearSelect.on("change", function() {
        const selectedYear = +this.value;
        updateBarChart(data, selectedYear);
    });

    function updateBarChart(data, year) {
        // Filter data for the selected year
        const yearData = data.filter(d => d.year === year);

        // Aggregate weight by building
        const aggregatedData = Array.from(
            d3.group(yearData, d => d.Building),
            ([key, value]) => ({ Building: key, Weight: d3.sum(value, d => d.weight) })
        );

        // Clear previous chart
        d3.select("#bar-chart").selectAll("*").remove();

        // Define margins, width, and height
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = 600 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = d3.select("#bar-chart").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        const x = d3.scaleBand().range([0, width]).padding(0.1);
        const y = d3.scaleLinear().range([height, 0]);

        x.domain(aggregatedData.map(d => d.Building));
        y.domain([0, d3.max(aggregatedData, d => d.Weight)]);

        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        svg.append("g")
            .call(d3.axisLeft(y));

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        svg.selectAll(".bar")
            .data(aggregatedData)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.Building))
            .attr("width", x.bandwidth())
            .attr("y", d => y(d.Weight))
            .attr("height", d => height - y(d.Weight))
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`Building: ${d.Building}<br>Weight: ${d.Weight} lbs`)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", d => {
                tooltip.transition().duration(500).style("opacity", 0);
            });
    }
}).catch(error => {
    console.error('Error loading the data:', error);
});
