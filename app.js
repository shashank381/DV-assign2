d3.json("data.json").then(data => {
    // Parse the date and weight
    data.forEach(d => {
        d.date = new Date(d.Date);
        d.year = d.date.getFullYear();
        d.weight = +d.Weight;
    });

    // Classification mappings
    const beforeSortingMap = {
        "Reusables in Compost": "Compost",
        "Reusables in Landfill": "Landfill",
        "Reusables in Recycling": "Recycling",
        "Compost in Landfill": "Landfill",
        "Compost in Recycling": "Recycling",
        "Landfill in Compost": "Compost",
        "Landfill in Recycling": "Recycling",
        "Recycling in Compost": "Compost",
        "Recycling in Landfill": "Landfill"
    };

    const afterSortingMap = {
        "Reusables in Compost": "Recycling",
        "Reusables in Landfill": "Recycling",
        "Reusables in Recycling": "Recycling",
        "Compost in Landfill": "Compost",
        "Compost in Recycling": "Compost",
        "Landfill in Compost": "Landfill",
        "Landfill in Recycling": "Landfill",
        "Recycling in Compost": "Recycling",
        "Recycling in Landfill": "Recycling"
    };

    // Consistent color scale
    const color = d3.scaleOrdinal()
        .domain(["Compost", "Recycling", "Landfill"])
        .range(["#4caf50", "#2196f3", "#9e9e9e"]); // Green, Blue, Grey

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
    let currentState = "before";
    let currentYear = years[0];
    updateStackedBarChart(data, currentYear, currentState);

    // Update chart on year selection change
    yearSelect.on("change", function() {
        currentYear = +this.value;
        updateStackedBarChart(data, currentYear, currentState);
    });

    // Toggle button
    d3.select("#toggle-button").on("click", function() {
        currentState = currentState === "before" ? "after" : "before";
        updateStackedBarChart(data, currentYear, currentState);
        d3.select(this).text(currentState === "before" ? "Show After Sorting" : "Show Before Sorting");
    });

    function updateStackedBarChart(data, year, state) {
        // Filter data for the selected year
        const yearData = data.filter(d => d.year === year);

        // Map data to before or after sorting categories
        const categorizedData = yearData.map(d => ({
            ...d,
            Stream: state === "before" ? beforeSortingMap[d.Stream] || d.Stream : afterSortingMap[d.Stream] || d.Stream
        }));

        // Ensure all streams are present
        const streams = ["Compost", "Recycling", "Landfill"];
        const emptyData = streams.reduce((acc, stream) => ({ ...acc, [stream]: 0 }), {});
        const aggregatedData = Array.from(
            d3.group(categorizedData, d => d.Building),
            ([key, values]) => ({
                Building: key,
                ...streams.reduce((acc, stream) => ({
                    ...acc,
                    [stream]: d3.sum(values, d => d.Stream === stream ? d.weight : 0)
                }), emptyData)
            })
        );

        // Stack the data
        const stack = d3.stack()
            .keys(streams)
            .value((d, key) => d[key]);
        const stackedData = stack(aggregatedData);

        // Define margins, width, and height
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = 600 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Select the SVG container, create it if it doesn't exist
        let svg = d3.select("#bar-chart svg");
        if (svg.empty()) {
            svg = d3.select("#bar-chart").append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        } else {
            svg = svg.select("g");
        }

        const x = d3.scaleBand().range([0, width]).padding(0.1);
        const y = d3.scaleLinear().range([height, 0]);

        x.domain(aggregatedData.map(d => d.Building));
        y.domain([0, d3.max(stackedData, d => d3.max(d, d => d[1]))]);

        // Update axes
        const xAxis = svg.selectAll(".x-axis").data([0]);
        xAxis.enter().append("g")
            .attr("class", "x-axis")
            .attr("transform", "translate(0," + height + ")")
            .merge(xAxis)
            .transition().duration(1000)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        const yAxis = svg.selectAll(".y-axis").data([0]);
        yAxis.enter().append("g")
            .attr("class", "y-axis")
            .merge(yAxis)
            .transition().duration(1000)
            .call(d3.axisLeft(y));

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // Create layers
        const layers = svg.selectAll("g.layer")
            .data(stackedData, d => d.key);

        layers.enter().append("g")
            .attr("class", "layer")
            .attr("fill", d => color(d.key))
            .merge(layers);

        layers.exit().remove();

        // Create bars
        const bars = layers.selectAll("rect")
            .data(d => d, d => d.data.Building);

        bars.enter().append("rect")
            .attr("x", d => x(d.data.Building))
            .attr("width", x.bandwidth())
            .attr("y", height)
            .attr("height", 0)
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`Building: ${d.data.Building}<br>Weight: ${d[1] - d[0]} lbs`)
                    .style("left", (event.pageX + 5) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", d => {
                tooltip.transition().duration(500).style("opacity", 0);
            })
            .merge(bars)
            .transition().duration(1000)
            .attr("x", d => x(d.data.Building))
            .attr("width", x.bandwidth())
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]));

        bars.exit().transition().duration(1000)
            .attr("y", height)
            .attr("height", 0)
            .remove();

        // Add legend
        const legend = svg.selectAll(".legend")
            .data(streams.slice().reverse());

        const legendEnter = legend.enter().append("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => "translate(0," + i * 20 + ")");

        legendEnter.append("rect")
            .attr("x", width - 18)
            .attr("width", 18)
            .attr("height", 18)
            .style("fill", color);

        legendEnter.append("text")
            .attr("x", width - 24)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "end")
            .text(d => d);

        legendEnter.merge(legend);

        legend.exit().remove();
    }
}).catch(error => {
    console.error('Error loading the data:', error);
});
